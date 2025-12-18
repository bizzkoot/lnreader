/* eslint-disable no-console */
window.reader = new (function () {
  const {
    readerSettings,
    chapterGeneralSettings,
    novel,
    chapter,
    nextChapter,
    prevChapter,
    batteryLevel,
    autoSaveInterval,
    DEBUG,
    strings,
  } = initialReaderConfig;

  // state
  this.hidden = van.state(true);
  this.batteryLevel = van.state(batteryLevel);
  this.readerSettings = van.state(readerSettings);
  this.generalSettings = van.state(chapterGeneralSettings);

  this.chapterElement = document.querySelector('#LNReader-chapter');
  this.selection = window.getSelection();
  this.viewport = document.querySelector('meta[name=viewport]');

  this.novel = novel;
  this.chapter = chapter;
  this.nextChapter = nextChapter;
  this.prevChapter = prevChapter;
  this.strings = strings;
  this.autoSaveInterval = autoSaveInterval;
  this.rawHTML = this.chapterElement.innerHTML;

  //layout props
  this.paddingTop = parseInt(
    getComputedStyle(document.querySelector('body')).getPropertyValue(
      'padding-top',
    ),
    10,
  );
  this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
  this.layoutHeight = window.screen.height;
  this.layoutWidth = window.screen.width;

  this.layoutEvent = undefined;
  this.chapterEndingVisible = van.state(false);
  this.hasPerformedInitialScroll = false;
  this.initialScrollPending = false;
  this.suppressSaveOnScroll = false;
  this.isUserScrolling = false;
  this.scrollTimeout = null;

  this.post = obj => {
    try {
      if (typeof window.__LNREADER_NONCE__ === 'string') {
        obj.nonce = window.__LNREADER_NONCE__;
      }
    } catch (e) {}
    window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  };
  this.refresh = () => {
    if (this.generalSettings.val.pageReader) {
      this.chapterWidth = this.chapterElement.scrollWidth;
    } else {
      this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
    }
  };

  van.derive(() => {
    const settings = this.readerSettings.val;

    // Invalidate cache when settings change as it might affect readability/layout
    this.invalidateCache();

    document.documentElement.style.setProperty(
      '--readerSettings-theme',
      settings.theme,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-padding',
      settings.padding + 'px',
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textSize',
      settings.textSize + 'px',
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textColor',
      settings.textColor,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-textAlign',
      settings.textAlign,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-lineHeight',
      settings.lineHeight,
    );
    document.documentElement.style.setProperty(
      '--readerSettings-fontFamily',
      settings.fontFamily,
    );
    if (settings.fontFamily) {
      new FontFace(
        settings.fontFamily,
        'url("file:///android_asset/fonts/' + settings.fontFamily + '.ttf")',
      )
        .load()
        .then(function (loadedFont) {
          document.fonts.add(loadedFont);
        });
    } else {
      // have no affect with a font declared in head
      document.fonts.forEach(fontFace => document.fonts.delete(fontFace));
    }
  });

  // Reactive bridge: apply TTS-related setting changes immediately
  van.derive(() => {
    const g = this.generalSettings.val || {};

    const ttsSettings = {
      enabled: !!g.TTSEnable,
      autoResume: g.ttsAutoResume,
      scrollPrompt: g.ttsScrollPrompt,
      showParagraphHighlight: !!g.showParagraphHighlight,
      // optional numeric/text fields if present
      rate: g.ttsRate,
      pitch: g.ttsPitch,
      voice: g.ttsVoice,
    };

    // Simple shallow equality guard to avoid noisy posts
    try {
      const prev = window.__prevTTSSettings || {};
      const changed = JSON.stringify(prev) !== JSON.stringify(ttsSettings);
      if (!changed) return;
      window.__prevTTSSettings = ttsSettings;
    } catch (e) {
      window.__prevTTSSettings = ttsSettings;
    }

    // Inform native side so native TTS can update immediately
    try {
      this.post({ type: 'tts-update-settings', data: ttsSettings });
    } catch (e) {
      // best-effort
      console.warn('tts-update-settings post failed', e);
    }

    // Also let the in-webview TTS instance apply non-native settings
    if (window.tts && typeof window.tts.applySettings === 'function') {
      try {
        window.tts.applySettings(ttsSettings);
      } catch (e) {
        console.warn('window.tts.applySettings failed', e);
      }
    }
  });

  this._cachedReadableElements = null;
  this._cacheInvalidated = true;

  this.invalidateCache = () => {
    this._cacheInvalidated = true;
  };

  this.getReadableElements = () => {
    // NEW: Check if chapterElement is still valid. If not, re-query it.
    if (!this.chapterElement || !this.chapterElement.isConnected) {
      console.log(
        'Reader: chapterElement is disconnected or missing, re-querying...',
      );
      this.chapterElement = document.querySelector('#LNReader-chapter');
      this._cacheInvalidated = true;
    }

    // NEW: Check if cache is valid by verifying the first element is connected
    if (this._cachedReadableElements && !this._cacheInvalidated) {
      if (
        this._cachedReadableElements.length > 0 &&
        !this._cachedReadableElements[0].isConnected
      ) {
        console.log(
          'Reader: Cached elements are disconnected, invalidating cache...',
        );
        this._cacheInvalidated = true;
      } else {
        return this._cachedReadableElements;
      }
    }

    const elements = [];
    const traverse = node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (window.tts.readable(node) && !window.tts.isContainer(node)) {
          elements.push(node);
        } else {
          for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i]);
          }
        }
      }
    };

    if (this.chapterElement) {
      traverse(this.chapterElement);
    } else {
      console.error('Reader: chapterElement not found even after re-query');
    }

    this._cachedReadableElements = elements;
    this._cacheInvalidated = false;

    return elements;
  };

  // Track user scrolling to prevent inappropriate calculatePages calls
  this.touchStartListener = () => {
    this.isUserScrolling = true;
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  };

  this.touchEndListener = () => {
    // Delay clearing the flag to ensure calculatePages doesn't run immediately after scroll
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 500); // 500ms delay after touch end
  };

  document.addEventListener('touchstart', this.touchStartListener);
  document.addEventListener('touchend', this.touchEndListener);

  // NEW: Debounced scroll handler to replace scrollend
  this.scrollDebounceTimer = null;
  this.accumulatedScrollDelta = 0;
  this.DIRECTION_CHANGE_THRESHOLD = 50; // pixels

  this.onScroll = () => {
    // NEW: Ignore scroll if TTS controller is being dragged
    if (
      document.getElementById('TTS-Controller')?.dataset?.dragging === 'true'
    ) {
      return;
    }

    if (this.suppressSaveOnScroll) {
      console.log('Skipping save on initial scroll');
      // FIX: Do NOT reset this here. Let calculatePages reset it after the timeout.
      return;
    }

    // NEW: Ignore scroll events during TTS auto-scroll
    if (window.tts && window.tts.isAutoScrolling) {
      // window.tts.log('Ignoring scroll event (auto-scroll in progress)');
      return;
    }

    const currentScrollY = window.scrollY;

    // Track accumulated scroll for "gentle scroll" detection
    if (window.tts && window.tts.reading) {
      const delta = currentScrollY - window.tts.lastKnownScrollY;
      this.accumulatedScrollDelta += delta;
    }

    window.tts.lastKnownScrollY = currentScrollY;

    // Debounce the actual processing
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }

    this.scrollDebounceTimer = setTimeout(() => {
      this.processScroll(currentScrollY);
    }, 150); // 150ms debounce
  };

  this.processScroll = currentScrollY => {
    // CRITICAL: Block scroll processing entirely during screen wake sync
    if (window.ttsScreenWakeSyncPending) {
      console.log('processScroll: BLOCKED - Screen wake sync pending');
      this.accumulatedScrollDelta = 0;
      return;
    }

    // ENHANCED: Detect user manual scroll during TTS
    if (window.tts && window.tts.reading) {
      // CASE 5.3 FIX: Block all scroll processing while Manual Mode Dialog is active
      // This prevents auto-scroll from being detected as "user scrolled forward"
      // which would reset the dialog state
      if (window.tts.dialogActive) {
        this.accumulatedScrollDelta = 0;
        return;
      }

      // Check if TTS has completed its auto-scroll before processing user scroll
      const timeSinceAutoScroll =
        Date.now() - (window.tts.lastAutoScrollTime || 0);
      if (timeSinceAutoScroll < window.tts.SCROLL_COOLDOWN) {
        this.accumulatedScrollDelta = 0; // Reset accumulation on cooldown
        return;
      }

      // Use accumulated delta for direction and magnitude
      const totalDelta = this.accumulatedScrollDelta;
      const absDelta = Math.abs(totalDelta);

      // Check scroll direction based on accumulated delta
      const isScrollingDown = totalDelta > 0;

      // Check if user scrolled significantly away (>1 screen height)
      // We use accumulated delta to catch "gentle" scrolling
      if (absDelta > reader.layoutHeight) {
        if (isScrollingDown) {
          window.tts.log('User scrolled forward (accumulated), continuing TTS');
          // Reset accumulation after processing "forward peek"
          this.accumulatedScrollDelta = 0;
        } else {
          window.tts.log('User scrolled backward (accumulated) significantly');

          // Find current visible paragraph using Intersection Ratio
          const readableElements = this.getReadableElements();
          let visibleParagraphIndex = -1;
          let maxVisibleRatio = 0;
          const viewportHeight = window.innerHeight;

          for (let i = 0; i < readableElements.length; i++) {
            const rect = readableElements[i].getBoundingClientRect();

            // Skip if completely out of view
            if (rect.bottom < 0 || rect.top > viewportHeight) continue;

            // Calculate intersection ratio
            const visibleHeight =
              Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
            const elementHeight = rect.height;

            // We care about how much of the viewport it takes OR how much of the element is visible
            // For long paragraphs, they might take 100% of viewport but only 10% of element is visible
            // So we prioritize "amount of screen covered"

            if (visibleHeight > maxVisibleRatio) {
              maxVisibleRatio = visibleHeight;
              visibleParagraphIndex = i;
            }
          }

          // Get current TTS paragraph
          const currentTTSIndex = readableElements.indexOf(
            window.tts.currentElement,
          );

          // If user is at least 3 paragraphs away, show confirmation
          if (
            visibleParagraphIndex !== -1 &&
            Math.abs(visibleParagraphIndex - currentTTSIndex) >= 3
          ) {
            window.tts.log(
              `User at paragraph ${visibleParagraphIndex}, TTS at ${currentTTSIndex} - showing manual mode prompt`,
            );

            // LOCK TTS POSITION
            window.tts.dialogActive = true;
            window.tts.lockedCurrentElement = window.tts.currentElement;
            window.tts.lockedParagraphIndex = currentTTSIndex;

            this.post({
              type: 'tts-manual-mode-prompt',
              data: {
                message: 'You scrolled back. Continue reading manually?',
                action: 'confirm-manual-mode',
                currentTTSIndex: currentTTSIndex,
                userVisibleIndex: visibleParagraphIndex,
              },
            });

            // Reset accumulation to prevent repeated triggers
            this.accumulatedScrollDelta = 0;
          }
        }
      }
    }

    // PROGRESS SAVING LOGIC
    // CRITICAL: Do NOT save progress if TTS is reading. TTS handles its own progress.
    // ALSO block saves during screen wake sync and shortly after TTS stops
    if (window.tts && window.tts.reading) {
      // window.tts.log('Skipping scroll-based save (TTS is reading)');
      return;
    }

    // BUG FIX: Block saves during screen wake sync
    if (window.ttsScreenWakeSyncPending) {
      console.log('processScroll: Skipping save - screen wake sync pending');
      return;
    }

    // BUG FIX: Block saves for 1000ms after initial scroll completes
    // This prevents stale scroll events from saving wrong positions
    const timeSinceInitialScroll =
      Date.now() - (reader.initialScrollCompleteTime || 0);
    if (reader.initialScrollCompleteTime && timeSinceInitialScroll < 1000) {
      console.log(
        'processScroll: Skipping save - initial scroll grace period (' +
          timeSinceInitialScroll +
          'ms)',
      );
      return;
    }

    // BUG FIX: Block saves shortly after TTS stops (grace period)
    // This prevents small scrolls from corrupting the TTS position
    const timeSinceTTSStop = Date.now() - (window.ttsLastStopTime || 0);
    if (timeSinceTTSStop < 2000) {
      // 2 second grace period
      console.log(
        'processScroll: Skipping save - TTS grace period (' +
          timeSinceTTSStop +
          'ms)',
      );
      return;
    }

    if (!this.generalSettings.val.pageReader) {
      this.saveProgress();
    }
  };

  // New helper to save progress
  this.saveProgress = () => {
    const readableElements = this.getReadableElements();
    const totalParagraphs = readableElements.length;
    let paragraphIndex = -1;

    // Use the same intersection logic for consistency
    let maxVisibleRatio = 0;
    const viewportHeight = window.innerHeight;

    for (let i = 0; i < readableElements.length; i++) {
      const rect = readableElements[i].getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) continue;
      const visibleHeight =
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      if (visibleHeight > maxVisibleRatio) {
        maxVisibleRatio = visibleHeight;
        paragraphIndex = i;
      }
    }

    if (paragraphIndex !== -1 && totalParagraphs > 0) {
      // Calculate progress from paragraph position (unified with TTS)
      const progress = Math.round(
        ((paragraphIndex + 1) / totalParagraphs) * 100,
      );
      this.post({
        type: 'save',
        data: progress,
        paragraphIndex,
        chapterId: this.chapter.id,
      });
    }
  };

  // Helper to get the index of the most visible paragraph
  // Used by back button handler to check for TTS/scroll position gap
  this.getVisibleElementIndex = () => {
    const readableElements = this.getReadableElements();
    const viewportHeight = window.innerHeight;
    let maxVisibleRatio = 0;
    let visibleIndex = 0;

    for (let i = 0; i < readableElements.length; i++) {
      const rect = readableElements[i].getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) continue;

      const visibleHeight =
        Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
      if (visibleHeight > maxVisibleRatio) {
        maxVisibleRatio = visibleHeight;
        visibleIndex = i;
      }
    }
    return visibleIndex;
  };

  document.addEventListener('scroll', this.onScroll, { passive: true });

  this.cleanup = () => {
    if (this.onScroll) {
      document.removeEventListener('scroll', this.onScroll);
    }
    if (this.touchStartListener) {
      document.removeEventListener('touchstart', this.touchStartListener);
    }
    if (this.touchEndListener) {
      document.removeEventListener('touchend', this.touchEndListener);
    }
  };

  window.addEventListener('beforeunload', () => {
    this.cleanup();
    if (window.tts && window.tts.cleanup) {
      window.tts.cleanup();
    }
  });

  if (DEBUG) {
    console = new Object();
    console.log = function (...data) {
      reader.post({ 'type': 'console', 'msg': data?.join(' ') });
    };
    console.debug = console.log;
    console.info = console.log;
    console.warn = console.log;
    console.error = console.log;
  }
  // end reader
})();

window.tts = new (function () {
  this.readableNodeNames = [
    '#text',
    'B',
    'I',
    'SPAN',
    'EM',
    'BR',
    'STRONG',
    'A',
    'P',
    'DIV',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
  ];
  this.blockNodeNames = [
    'P',
    'DIV',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'SECTION',
    'ARTICLE',
    'MAIN',
    'HEADER',
    'FOOTER',
  ];
  this.prevElement = null;
  this.currentElement = reader.chapterElement;
  this.started = false;
  this.reading = false;

  // CONSTANTS
  this.CONSTANTS = {
    SCROLL_COOLDOWN: 700,
    HIGHLIGHT_THROTTLE: 50,
    SCROLL_LOCK_DURATION: 600,
    MANUAL_SCROLL_THRESHOLD: 0.5, // 50% of layout height
    AUTO_SCROLL_THRESHOLD_TOP: 0,
    AUTO_SCROLL_THRESHOLD_BOTTOM: 1.0,
    SWIPE_THRESHOLD: 180,
  };

  // DEBUG
  this.DEBUG_TTS = false;
  this.log = (...args) => {
    if (this.DEBUG_TTS || initialReaderConfig.DEBUG) {
      console.log('[TTS]', ...args);
    }
  };

  // Apply settings from reader.generalSettings immediately in the webview
  this.applySettings = settings => {
    try {
      this.log('Applying settings', settings);
      if (settings.enabled !== undefined) {
        this.enabled = !!settings.enabled;
      }
      if (settings.rate !== undefined) {
        this.rate = settings.rate;
      }
      if (settings.pitch !== undefined) {
        this.pitch = settings.pitch;
      }
      if (settings.voice !== undefined) {
        this.voice = settings.voice;
      }
      if (settings.showParagraphHighlight !== undefined) {
        this.showParagraphHighlight = !!settings.showParagraphHighlight;
      }

      // If currently reading, we prefer to update parameters in-place without stopping.
      // Notify native side as well so native TTS engine can adjust immediately.
      try {
        if (reader && typeof reader.post === 'function') {
          reader.post({ type: 'tts-apply-settings', data: settings });
        }
      } catch (e) {
        this.log('Failed to post tts-apply-settings', e);
      }
    } catch (e) {
      console.warn('applySettings error', e);
    }
  };

  // ICONS
  this.volumeIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" /><path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" /></svg>';
  this.resumeIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>';
  this.pauseIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg>';

  // NEW: Scroll control flags for TTS
  this.isAutoScrolling = false; // Flag for programmatic scroll
  this.scrollLockTimeout = null; // Timeout to release lock
  this.lastAutoScrollTime = 0; // Track when scroll started
  this.SCROLL_COOLDOWN = this.CONSTANTS.SCROLL_COOLDOWN;

  // NEW: User scroll detection
  this.userScrollDetected = false;
  this.lastKnownScrollY = 0;

  // FIX: Method to fully reset scroll lock state (both flag AND cooldown)
  // Called after sync operations to allow immediate taps
  this.resetScrollLock = () => {
    this.isAutoScrolling = false;
    this.lastAutoScrollTime = 0;
    if (this.scrollLockTimeout) {
      clearTimeout(this.scrollLockTimeout);
      this.scrollLockTimeout = null;
    }
    this.log('Scroll lock explicitly reset');
  };

  // NEW: Handle user manual scroll when TTS is paused
  this.manualScrollListener = () => {
    if (!window.tts || window.tts.reading) return; // Only when TTS is paused
    if (window.tts.isAutoScrolling) return; // Ignore during auto-scroll

    const currentScrollY = window.scrollY;
    const scrollDifference = window.tts.lastKnownScrollY - currentScrollY;

    // User scrolled up significantly (more than half screen)
    if (
      scrollDifference >
      reader.layoutHeight * this.CONSTANTS.MANUAL_SCROLL_THRESHOLD
    ) {
      this.lastManualScrollTime = Date.now(); // Update manual scroll time
      this.log('User scrolled up while paused, checking for position change');

      // Find which paragraph is now in view
      const readableElements = reader.getReadableElements();
      let visibleParagraphIndex = -1;

      for (let i = 0; i < readableElements.length; i++) {
        if (window.tts.isElementInViewport(readableElements[i])) {
          visibleParagraphIndex = i;
          break;
        }
      }

      // Get current TTS paragraph
      const currentTTSIndex = readableElements.indexOf(
        window.tts.currentElement,
      );

      // User scrolled to an earlier paragraph
      if (
        visibleParagraphIndex !== -1 &&
        visibleParagraphIndex < currentTTSIndex - 2
      ) {
        // At least 2 paragraphs back

        console.log(
          `TTS: User at paragraph ${visibleParagraphIndex}, TTS at ${currentTTSIndex}`,
        );

        // Check user preference
        if (reader.generalSettings.val.ttsScrollPrompt === 'always-ask') {
          // Send prompt to React Native
          reader.post({
            type: 'tts-scroll-prompt',
            data: {
              currentIndex: currentTTSIndex,
              visibleIndex: visibleParagraphIndex,
              action: 'ask',
            },
          });
        } else if (
          reader.generalSettings.val.ttsScrollPrompt === 'auto-change'
        ) {
          // Automatically change TTS position
          window.tts.currentElement = readableElements[visibleParagraphIndex];
          console.log(
            `TTS: Auto-changed position to paragraph ${visibleParagraphIndex}`,
          );

          reader.post({
            type: 'show-toast',
            data: `TTS position updated to paragraph ${
              visibleParagraphIndex + 1
            }`,
          });
        }
        // If 'never-change', do nothing
      }
    }

    window.tts.lastKnownScrollY = currentScrollY;
  };

  window.addEventListener('touchend', this.manualScrollListener);

  this.cleanup = () => {
    if (this.manualScrollListener) {
      window.removeEventListener('touchend', this.manualScrollListener);
    }
  };

  this.isContainer = element => {
    for (let i = 0; i < element.children.length; i++) {
      if (this.blockNodeNames.includes(element.children[i].nodeName)) {
        return true;
      }
    }
    return false;
  };

  this.readable = element => {
    const ele = element ?? this.currentElement;
    if (!ele) return false;

    // Check if element itself is readable tag
    if (!this.readableNodeNames.includes(ele.nodeName)) {
      return false;
    }

    // Must have some text content
    if (!ele.textContent || ele.textContent.trim().length === 0) {
      return false;
    }

    return true;
  };

  this.normalizeText = text => {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\s*([.,!?;:])\s*/g, '$1 ')
      .trim();
  };

  // if can find a readable node, else stop tts
  this.findNextTextNode = () => {
    if (this.currentElement.isSameNode(reader.chapterElement) && this.started) {
      return false;
    } else {
      this.started = true;
    }

    // is read, have to go next or go back
    if (this.currentElement.isSameNode(this.prevElement)) {
      this.prevElement = this.currentElement;
      if (this.currentElement.nextElementSibling) {
        this.currentElement = this.currentElement.nextElementSibling;
      } else {
        this.currentElement = this.currentElement.parentElement;
      }
      return this.findNextTextNode();
    } else {
      // can read? read it
      if (this.readable() && !this.isContainer(this.currentElement)) {
        return true;
      }
      if (
        !this.prevElement?.parentElement?.isSameNode(this.currentElement) &&
        this.currentElement.firstElementChild
      ) {
        // go deep
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.firstElementChild;
      } else if (this.currentElement.nextElementSibling) {
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.nextElementSibling;
      } else {
        this.prevElement = this.currentElement;
        this.currentElement = this.currentElement.parentElement;
      }
      return this.findNextTextNode();
    }
  };

  this.next = () => {
    try {
      this.currentElement?.classList?.remove('highlight');
      if (this.findNextTextNode()) {
        const text = this.normalizeText(this.currentElement?.innerText);
        if (text) {
          this.reading = true;
          this.speak();
        } else {
          this.next();
        }
      } else {
        this.reading = false;
        this.stop();
        if (reader.nextChapter) {
          // Post 'next' with autoStartTTS flag - React Native will decide
          // whether to actually start TTS based on ttsContinueToNextChapter setting
          reader.post({ type: 'next', autoStartTTS: true });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  this.restoreState = config => {
    this.log('Restore state called with config:', config);

    // NEW: Force layout refresh to ensure dimensions are correct
    if (window.reader && window.reader.refresh) {
      window.reader.refresh();
      this.log('Forced reader refresh');
    }

    if (!config || !config.shouldResume) {
      console.log('TTS: No resume needed');
      this.hasAutoResumed = true;

      if (config?.startFromBeginning) {
        console.log('TTS: User chose to restart from beginning');
        this.start();
      }
      return;
    }

    const readableElements = reader.getReadableElements();
    const paragraphIndex = config.paragraphIndex;

    if (paragraphIndex >= 0 && readableElements[paragraphIndex]) {
      this.log('Resuming from paragraph index:', paragraphIndex);

      this.hasAutoResumed = true;
      this.started = true; // NEW: Set started to true to prevent findNextTextNode failure
      this.currentElement = readableElements[paragraphIndex];
      // CRITICAL FIX: Set prevElement to element BEFORE current to prevent skip
      // When next() is called, it checks if currentElement equals prevElement
      // If they're the same, it advances. By setting prevElement to previous paragraph,
      // next() will see currentElement as "unread" and speak it.
      this.prevElement =
        paragraphIndex > 0 ? readableElements[paragraphIndex - 1] : null;

      // DEBUG: Log element status
      const rect = this.currentElement.getBoundingClientRect();
      this.log(
        `Resuming element status: isConnected=${
          this.currentElement.isConnected
        }, rect=${JSON.stringify(rect)}`,
      );

      // NEW: Force scroll (remove true arg) to ensure user sees the element even if system thinks it's visible
      this.scrollToElement(this.currentElement);

      if (config.autoStart) {
        this.log('Auto-starting playback from current paragraph');
        setTimeout(() => {
          // FIX: Call speak() directly on the current element instead of next()
          // This ensures the saved paragraph is spoken, not skipped
          this.reading = true;
          this.speak();
        }, 500);
      } else {
        this.log('Positioned at paragraph but not auto-starting');
        this.currentElement.classList.add('highlight');
        reader.post({
          type: 'tts-positioned',
          data: { paragraphIndex },
        });
      }
    } else {
      this.log('Paragraph not found, starting from beginning');
      this.start();
    }
  };

  this.hasAutoResumed = false;

  // NEW: Track if background TTS playback is active (RN is driving playback)
  // This prevents resume prompts from showing when user returns from background
  this.isBackgroundPlaybackActive = false;

  this.start = element => {
    // CRITICAL: If background playback is active, don't interfere
    // This can happen when user wakes screen during background TTS
    if (this.isBackgroundPlaybackActive) {
      this.log('Skipping start() - background playback is active');
      return;
    }

    this.stop();
    if (element) {
      this.log('Starting from specific element');
      this.currentElement = element;
    } else {
      const readableElements = reader.getReadableElements();
      const savedIndex = initialReaderConfig.savedParagraphIndex;

      this.log(
        'Raw general settings:',
        JSON.stringify(reader.generalSettings.val),
      );
      const autoResumeSetting =
        reader.generalSettings.val.ttsAutoResume || 'prompt';

      // Priority 1: Force Resume from Saved Index (First Run Only)
      // Only if setting is NOT 'never'. If 'prompt', we assume the user already approved via native prompt
      // or if they manually pressed play, we default to resuming.
      // But if 'never', we should skip this and start from visible.
      if (
        !this.hasAutoResumed &&
        savedIndex !== undefined &&
        savedIndex >= 0 &&
        autoResumeSetting !== 'never'
      ) {
        if (readableElements[savedIndex]) {
          if (autoResumeSetting === 'prompt') {
            this.log('Requesting confirmation for resume');
            this.hasAutoResumed = true; // NEW: Mark as handled to prevent loops if user declines
            reader.post({
              type: 'request-tts-confirmation',
              data: { savedIndex: savedIndex },
            });
            return;
          }

          this.log(
            'Force Resume - Starting from saved paragraph index:',
            savedIndex,
            'Setting:',
            autoResumeSetting,
          );
          this.hasAutoResumed = true;
          this.currentElement = readableElements[savedIndex];
          this.scrollToElement(this.currentElement, true);
          this.next();
          return;
        } else {
          console.log(
            'TTS: Saved index',
            savedIndex,
            'not found in readableElements of length',
            readableElements.length,
          );
        }
      } else {
        console.log(
          'TTS: Skipping resume. hasAutoResumed:',
          this.hasAutoResumed,
          'savedIndex:',
          savedIndex,
          'Setting:',
          autoResumeSetting,
        );
      }

      // Priority 2: First "Significant" Visible Element (Manual Start)
      // We want the element that is closest to the top of the viewport,
      // but we need to be careful about elements that are only slightly visible at the top.
      let bestElement = null;
      let minTopDistance = Infinity;

      for (let i = 0; i < readableElements.length; i++) {
        const el = readableElements[i];
        const rect = el.getBoundingClientRect();

        // Check if element is in viewport
        if (
          rect.bottom > 0 &&
          rect.top <
            (window.innerHeight || document.documentElement.clientHeight)
        ) {
          // We prefer elements that start near the top (positive rect.top)
          // If rect.top is negative, it means the element started ABOVE the viewport.
          // If rect.top is very small (e.g. < 50px), it might be the one we want if we just scrolled there.

          // Let's try to find the first element whose TOP is within the viewport ( >= 0 )
          if (rect.top >= 0 && rect.top < minTopDistance) {
            minTopDistance = rect.top;
            bestElement = el;
          }
        }
      }

      // Fallback: If no element starts IN the viewport (e.g. a long paragraph covers the whole screen),
      // pick the first one that is visible at all.
      if (!bestElement) {
        for (let i = 0; i < readableElements.length; i++) {
          if (this.isElementInViewport(readableElements[i])) {
            bestElement = readableElements[i];
            break;
          }
        }
      }

      if (bestElement) {
        this.log(
          'Found best visible element:',
          bestElement.textContent.substring(0, 20),
        );
        this.currentElement = bestElement;
      } else {
        console.log('TTS: No visible element found, starting from beginning');
        this.currentElement = reader.chapterElement;
      }
    }

    // NEW: Initialize scroll tracking
    this.lastKnownScrollY = window.scrollY;
    this.userScrollDetected = false;

    this.next();
  };

  this.resume = (forceResume = false) => {
    // NEW: Toggle behavior - if already reading, pause
    if (this.reading) {
      this.log('resume() called but already reading - toggling to pause');
      this.pause();
      return;
    }

    if (!this.reading) {
      if (
        this.started &&
        this.currentElement &&
        this.currentElement.id !== 'LNReader-chapter'
      ) {
        // NEW: Check if user scrolled away while paused
        if (!forceResume) {
          // If the current TTS element is still visible, we don't need to prompt
          if (this.isElementInViewport(this.currentElement)) {
            console.log(
              'TTS: Current element is visible, skipping scroll check',
            );
          } else {
            const readableElements = reader.getReadableElements();
            let visibleParagraphIndex = -1;

            // Find first visible paragraph
            for (let i = 0; i < readableElements.length; i++) {
              if (this.isElementInViewport(readableElements[i])) {
                visibleParagraphIndex = i;
                break;
              }
            }

            const currentTTSIndex = readableElements.indexOf(
              this.currentElement,
            );

            // If we found a visible paragraph and it's significantly different from TTS position
            if (
              visibleParagraphIndex !== -1 &&
              Math.abs(visibleParagraphIndex - currentTTSIndex) >= 2
            ) {
              console.log(
                `TTS: Resume requested but user scrolled away. TTS: ${currentTTSIndex}, Visible: ${visibleParagraphIndex}`,
              );

              // Send prompt to React Native
              reader.post({
                type: 'tts-resume-location-prompt',
                data: {
                  currentIndex: currentTTSIndex,
                  visibleIndex: visibleParagraphIndex,
                },
              });
              return;
            }
          }
        }

        this.speak();
        this.reading = true;

        // Update TTS controller icon to show pause icon
        const controller = document.getElementById('TTS-Controller');
        if (controller?.firstElementChild) {
          controller.firstElementChild.innerHTML = this.pauseIcon;
        }
      } else {
        this.start();
      }
    }
  };

  this.pause = () => {
    this.reading = false;

    // Set global TTS operation flag during pause
    window.ttsOperationActive = true;

    reader.post({ type: 'stop-speak' });

    const readableElements = reader.getReadableElements();
    const paragraphIndex = readableElements.indexOf(this.currentElement);

    // Save with explicit paragraph index
    reader.post({
      type: 'save',
      data: parseInt(
        ((window.scrollY + reader.layoutHeight) / reader.chapterHeight) * 100,
        10,
      ),
      paragraphIndex: paragraphIndex,
      chapterId: reader.chapter.id,
    });

    reader.post({
      type: 'tts-state',
      data: {
        isReading: false,
        paragraphIndex: paragraphIndex,
        timestamp: Date.now(),
      },
    });

    // Update TTS controller icon to show resume/play icon
    const controller = document.getElementById('TTS-Controller');
    if (controller?.firstElementChild) {
      controller.firstElementChild.innerHTML = this.resumeIcon;
    }

    // Clear operation flag after a brief delay
    setTimeout(() => {
      window.ttsOperationActive = false;
      window.ttsOperationEndTime = Date.now();
    }, 100);
  };

  this.stop = () => {
    // Set global TTS operation flag during stop
    window.ttsOperationActive = true;
    // BUG FIX: Track when TTS stops to implement grace period for scroll saves
    window.ttsLastStopTime = Date.now();

    reader.post({ type: 'stop-speak' });
    this.currentElement?.classList?.remove('highlight');
    this.prevElement = null;

    // NEW: Don't reset currentElement to chapterElement here
    // this.currentElement = reader.chapterElement;

    this.started = false;
    this.reading = false;

    // Reset background playback flag when stopping
    this.isBackgroundPlaybackActive = false;

    // NEW: Don't reset auto-resume flag here, it causes loops in start()
    // this.hasAutoResumed = false;

    reader.post({ type: 'tts-state', data: { isReading: false } });

    // FIX Bug 12.2: Save TTS position (not scroll position) when stopping
    // Previously called reader.saveProgress() which uses getVisibleElementIndex() (scroll-based)
    // Now we save the actual TTS paragraph index from currentElement
    const readableElements = reader.getReadableElements();
    const ttsIndex = this.currentElement
      ? readableElements.indexOf(this.currentElement)
      : -1;

    if (ttsIndex >= 0 && readableElements.length > 0) {
      const percentage = Math.round(
        ((ttsIndex + 1) / readableElements.length) * 100,
      );
      console.log(
        'TTS stop: Saving TTS position',
        ttsIndex,
        'of',
        readableElements.length,
        '(' + percentage + '%)',
      );
      reader.post({
        type: 'save',
        data: percentage,
        paragraphIndex: ttsIndex,
        chapterId: reader.chapter.id,
        source: 'tts-stop', // Debug: distinguish from scroll saves
      });
    } else if (reader.saveProgress) {
      // Fallback: if no TTS element tracked, use scroll-based save
      // BUT: respect grace period to avoid overwriting TTS pause position
      const timeSinceTTSStop = Date.now() - (window.ttsLastStopTime || 0);
      if (timeSinceTTSStop < 2000) {
        console.log(
          'TTS stop: Skipping fallback save - grace period (' +
            timeSinceTTSStop +
            'ms)',
        );
      } else {
        console.log(
          'TTS stop: No TTS element tracked, falling back to scroll-based save',
        );
        reader.saveProgress();
      }
    }

    // NEW: Reset TTS controller icon
    const controller = document.getElementById('TTS-Controller');
    if (controller?.firstElementChild) {
      controller.firstElementChild.innerHTML = this.volumeIcon;
    }

    // Clear operation flag after a brief delay
    setTimeout(() => {
      window.ttsOperationActive = false;
      window.ttsOperationEndTime = Date.now();
    }, 100);
  };

  this.isElementInViewport = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const windowWidth =
      window.innerWidth || document.documentElement.clientWidth;

    // DEBUG: Log dimensions if something seems wrong (e.g. negative or zero)
    if (windowHeight === 0 || rect.width === 0 || rect.height === 0) {
      this.log(
        `isElementInViewport suspicious: winH=${windowHeight}, rect=${JSON.stringify(
          rect,
        )}`,
      );
    }

    // Check for partial visibility
    return (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0
    );
  };

  this.scrollToElement = (element, checkVisibility = false) => {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;

    // Check if element is FULLY visible
    const isFullyVisible = rect.top >= 0 && rect.bottom <= windowHeight;

    const isPartiallyVisible =
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    // NEW: If checkVisibility is true and element is fully visible, skip scroll
    if (checkVisibility && isFullyVisible) {
      console.log('TTS: Element is fully visible, skipping initial scroll');
      return;
    }

    // Only scroll if element is not visible or barely visible
    if (
      !isPartiallyVisible ||
      rect.top < this.CONSTANTS.AUTO_SCROLL_THRESHOLD_TOP ||
      rect.bottom > windowHeight * this.CONSTANTS.AUTO_SCROLL_THRESHOLD_BOTTOM
    ) {
      // NEW: Set flag BEFORE scrolling
      this.isAutoScrolling = true;
      this.lastAutoScrollTime = Date.now();
      this.log('Starting auto-scroll (locked)');

      // Clear previous timeout
      if (this.scrollLockTimeout) {
        clearTimeout(this.scrollLockTimeout);
      }

      // Check user's motion preference
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const userScrolling = Date.now() - this.lastManualScrollTime < 2000;

      element.scrollIntoView({
        behavior: prefersReducedMotion || userScrolling ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });

      // NEW: Release lock after animation completes
      // Smooth scroll typically takes 300-500ms
      this.scrollLockTimeout = setTimeout(() => {
        this.isAutoScrolling = false;
        this.log('Auto-scroll complete (unlocked)');
      }, this.CONSTANTS.SCROLL_LOCK_DURATION); // Buffer time for smooth scroll animation
    }
  };

  this.speak = () => {
    try {
      if (!this.currentElement) {
        console.warn('TTS: No current element to speak');
        return;
      }

      // Set global TTS operation flag to protect against ResizeObserver
      window.ttsOperationActive = true;

      // CRITICAL: During manual mode dialog, prevent any position changes
      if (this.dialogActive) {
        console.log('TTS: Dialog active - speaking from locked position');
        this.reading = true;

        const text = this.currentElement.textContent;
        if (text && text.trim().length > 0) {
          this.log('Speaking (locked)', text.substring(0, 20));
          reader.post({ type: 'speak', data: text });
          reader.post({
            type: 'tts-state',
            data: {
              isReading: true,
              paragraphIndex: this.lockedParagraphIndex || 0,
            },
          });
        }
        return; // Don't progress to next paragraph when dialog is active
      }

      this.prevElement = this.currentElement;
      this.scrollToElement(this.currentElement);
      if (reader.generalSettings.val.showParagraphHighlight) {
        this.currentElement.classList.add('highlight');
      }

      // Save progress based on current TTS element
      const readableElements = reader.getReadableElements();
      const paragraphIndex = readableElements.indexOf(this.currentElement);
      if (paragraphIndex !== -1) {
        reader.post({
          type: 'save',
          data: parseInt(
            ((window.scrollY + reader.layoutHeight) / reader.chapterHeight) *
              100,
            10,
          ),
          paragraphIndex,
          chapterId: reader.chapter.id,
        });
      }

      // Use textContent to ensure indices match for highlighting
      const text = this.currentElement.textContent;
      if (text && text.trim().length > 0) {
        this.log('Speaking', text.substring(0, 20));
        // Include paragraphIndex so RN can create utteranceId matching the batch format
        reader.post({
          type: 'speak',
          data: text,
          paragraphIndex: paragraphIndex,
        });
        reader.post({
          type: 'tts-state',
          data: {
            isReading: true,
            paragraphIndex: paragraphIndex,
            totalParagraphs: readableElements.length,
            progress: Math.round(
              (paragraphIndex / readableElements.length) * 100,
            ),
            currentText:
              text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            timestamp: Date.now(),
          },
        });

        // Update TTS controller icon to show pause icon when speaking
        const controller = document.getElementById('TTS-Controller');
        if (controller?.firstElementChild) {
          controller.firstElementChild.innerHTML = this.pauseIcon;
        }

        // NEW: Send lookahead queue for background playback
        const nextTexts = [];
        for (
          let i = paragraphIndex + 1;
          i < readableElements.length && i < paragraphIndex + 50;
          i++
        ) {
          const el = readableElements[i];
          if (this.readable(el) && !this.isContainer(el)) {
            nextTexts.push(el.textContent);
          }
        }
        if (nextTexts.length > 0) {
          reader.post({
            type: 'tts-queue',
            data: nextTexts,
            startIndex: paragraphIndex + 1,
          });
        }
      } else {
        this.next();
      }
    } catch (error) {
      console.error('TTS: Error in speak():', error);
      this.reading = false;
      reader.post({
        type: 'tts-error',
        data: {
          error: error.message,
          element: this.currentElement?.tagName,
          action: 'speak',
        },
      });
    }
  };

  this.handleManualModeDialog = action => {
    console.log(`TTS: Manual mode dialog action: ${action}`);

    if (action === 'continue') {
      // User wants to continue TTS following - restore normal operation
      this.dialogActive = false;
      this.lockedCurrentElement = null;
      this.lockedParagraphIndex = null;
      console.log('TTS: Resumed normal following mode');

      // Continue with normal TTS progression from current locked position
      setTimeout(() => {
        this.next();
      }, 100);
    } else if (action === 'stop') {
      // User wants to stop TTS and read manually
      this.dialogActive = false;
      console.log('TTS: Stopped - user chose manual reading');
      this.stop();
    }
  };

  // NEW: Method to change TTS position from user action
  this.changeParagraphPosition = paragraphIndex => {
    const readableElements = reader.getReadableElements();

    if (paragraphIndex >= 0 && paragraphIndex < readableElements.length) {
      this.currentElement = readableElements[paragraphIndex];
      this.prevElement = null; // Reset to avoid confusion
      this.scrollToElement(this.currentElement);

      // Highlight the new position
      if (reader.generalSettings.val.showParagraphHighlight) {
        // Remove old highlight
        const oldHighlight = document.querySelector('.highlight');
        if (oldHighlight) {
          oldHighlight.classList.remove('highlight');
        }

        // Add new highlight
        this.currentElement.classList.add('highlight');
      }

      console.log(`TTS: Position changed to paragraph ${paragraphIndex}`);
      return true;
    }

    return false;
  };

  // NEW: Silent highlight update for RN-driven background playback
  // Now accepts optional chapterId to validate against stale events from old chapters
  this.highlightParagraph = (paragraphIndex, chapterId) => {
    // CRITICAL: Validate chapter ID to prevent stale events from old chapter causing wrong scrolls
    if (chapterId !== undefined && chapterId !== reader.chapter.id) {
      console.log(
        `TTS: highlightParagraph ignored - stale chapter ${chapterId}, current is ${reader.chapter.id}`,
      );
      return false;
    }

    const readableElements = reader.getReadableElements();

    // Guard against out-of-bounds indices (e.g., from stale events during chapter transition)
    if (paragraphIndex < 0 || paragraphIndex >= readableElements.length) {
      console.warn(
        `TTS: highlightParagraph index ${paragraphIndex} out of bounds (${readableElements.length} elements)`,
      );
      return false;
    }

    // Mark background playback as active - this prevents resume prompts from interfering
    this.isBackgroundPlaybackActive = true;
    this.reading = true; // Mark as reading since background TTS is active
    this.hasAutoResumed = true; // Prevent resume prompts

    this.currentElement = readableElements[paragraphIndex];
    this.prevElement = readableElements[paragraphIndex - 1] || null;

    this.scrollToElement(this.currentElement);

    // FIX: Reset scroll lock after sync to allow immediate taps
    setTimeout(() => {
      this.resetScrollLock();
    }, this.CONSTANTS.SCROLL_LOCK_DURATION);

    if (reader.generalSettings.val.showParagraphHighlight) {
      const oldHighlight = document.querySelector('.highlight');
      if (oldHighlight) oldHighlight.classList.remove('highlight');
      this.currentElement.classList.add('highlight');
    }
    return true;
  };

  // NEW: Sync internal state from RN (for background playback resume)
  // Now accepts optional chapterId to validate against stale events from old chapters
  this.updateState = (paragraphIndex, chapterId) => {
    // CRITICAL: Validate chapter ID to prevent stale events from old chapter corrupting state
    if (chapterId !== undefined && chapterId !== reader.chapter.id) {
      console.log(
        `TTS: updateState ignored - stale chapter ${chapterId}, current is ${reader.chapter.id}`,
      );
      return;
    }

    console.log(`TTS: updateState called with index ${paragraphIndex}`);
    const readableElements = reader.getReadableElements();
    if (paragraphIndex >= 0 && paragraphIndex < readableElements.length) {
      // Mark background playback as active
      this.isBackgroundPlaybackActive = true;
      this.reading = true;
      this.hasAutoResumed = true;

      this.currentElement = readableElements[paragraphIndex];
      this.prevElement = readableElements[paragraphIndex - 1] || null;
      this.started = true; // Ensure next() works from here

      // NEW: Save progress when state is updated from Native (Background TTS)
      reader.post({
        type: 'save',
        data: parseInt(
          ((window.scrollY + reader.layoutHeight) / reader.chapterHeight) * 100,
          10,
        ),
        paragraphIndex,
        chapterId: reader.chapter.id,
      });
    } else {
      console.warn(`TTS: updateState index ${paragraphIndex} out of bounds`);
    }
  };

  this.lastHighlightTime = 0;
  this.HIGHLIGHT_THROTTLE = this.CONSTANTS.HIGHLIGHT_THROTTLE;

  this.highlightRange = (start, end) => {
    const now = Date.now();
    if (now - this.lastHighlightTime < this.HIGHLIGHT_THROTTLE) {
      return; // Skip if called too frequently
    }
    this.lastHighlightTime = now;

    // Remove previous word highlights
    const highlights = this.currentElement.querySelectorAll('.word-highlight');
    const fragment = document.createDocumentFragment();

    highlights.forEach(h => {
      while (h.firstChild) {
        fragment.appendChild(h.firstChild);
      }
      h.parentNode.replaceChild(fragment, h);
    });

    this.currentElement.normalize();

    if (start < 0 || end <= start) return;

    const nodes = [];
    let charCount = 0;

    const traverse = node => {
      if (charCount >= end) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + node.length;
        if (nextCharCount > start && charCount < end) {
          const nodeStart = Math.max(0, start - charCount);
          const nodeEnd = Math.min(node.length, end - charCount);
          nodes.push({ node, start: nodeStart, end: nodeEnd });
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
      }
    };

    traverse(this.currentElement);

    nodes.forEach(({ node, start: nodeStart, end: nodeEnd }) => {
      try {
        const range = document.createRange();
        range.setStart(node, nodeStart);
        range.setEnd(node, nodeEnd);
        const span = document.createElement('span');
        span.className = 'word-highlight';
        range.surroundContents(span);
      } catch (e) {
        // Ignore errors if range is invalid or overlaps
      }
    });
  };
})();

window.pageReader = new (function () {
  this.page = van.state(0);
  this.totalPages = van.state(0);
  this.chapterEndingVisible = van.state(
    initialPageReaderConfig.nextChapterScreenVisible,
  );
  this.chapterEnding = document.getElementsByClassName('transition-chapter')[0];

  this.showChapterEnding = (bool, instant, left) => {
    if (!this.chapterEnding) {
      this.chapterEnding =
        document.getElementsByClassName('transition-chapter')[0];
      if (!this.chapterEnding) return;
    }
    this.chapterEnding.style.transition = 'unset';
    if (bool) {
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      requestAnimationFrame(() => {
        if (!instant) this.chapterEnding.style.transition = '200ms';
        this.chapterEnding.style.transform = 'translateX(-100vw)';
      });
      this.chapterEndingVisible.val = true;
    } else {
      if (!instant) this.chapterEnding.style.transition = '200ms';
      this.chapterEnding.style.transform = `translateX(${left ? -200 : 0}vw)`;
      this.chapterEndingVisible.val = false;
    }
  };

  this.movePage = destPage => {
    if (this.chapterEndingVisible.val) {
      if (destPage < 0) {
        this.showChapterEnding(false);
        return;
      }
      if (destPage < this.totalPages.val) {
        this.showChapterEnding(false, false, true);
        return;
      }
      if (destPage >= this.totalPages.val) {
        return reader.post({ type: 'next' });
      }
    }
    destPage = parseInt(destPage, 10);
    if (destPage < 0) {
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.prevChapter.name;
      this.showChapterEnding(true, false, true);
      setTimeout(() => {
        reader.post({ type: 'prev' });
      }, 200);
      return;
    }
    if (destPage >= this.totalPages.val) {
      document.getElementsByClassName('transition-chapter')[0].innerText =
        reader.nextChapter.name;
      this.showChapterEnding(true);
      setTimeout(() => {
        reader.post({ type: 'next' });
      }, 200);
      return;
    }
    this.page.val = destPage;
    reader.chapterElement.style.transform =
      'translateX(-' + destPage * 100 + '%)';

    const newProgress = parseInt(
      ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100,
      10,
    );

    if (newProgress > reader.chapter.progress) {
      reader.post({
        type: 'save',
        data: parseInt(
          ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100,
          10,
        ),
        chapterId: reader.chapter.id,
      });
    }
  };

  van.derive(() => {
    // ignore if initial or other states change
    if (
      reader.generalSettings.val.pageReader ===
      reader.generalSettings.oldVal.pageReader
    ) {
      return;
    }
    if (reader.generalSettings.val.pageReader) {
      const ratio = Math.min(
        0.99,
        (window.scrollY + reader.layoutHeight) / reader.chapterHeight,
      );
      document.body.classList.add('page-reader');
      setTimeout(() => {
        reader.refresh();
        this.totalPages.val = parseInt(
          (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
            reader.layoutWidth,
          10,
        );
        this.movePage(this.totalPages.val * ratio);
      }, 100);
    } else {
      reader.chapterElement.style = '';
      document.body.classList.remove('page-reader');
      setTimeout(() => {
        reader.refresh();
        window.scrollTo({
          top:
            (reader.chapterHeight * (this.page.val + 1)) / this.totalPages.val -
            reader.layoutHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  if (pageReader.chapterEndingVisible.val) {
    pageReader.showChapterEnding(true, true);
  }
});

function calculatePages() {
  const now = Date.now();

  // BUG 3 FIX: Block calculatePages during screen wake sync to prevent scroll jumble
  // This flag is set by RN when screen wakes during background TTS playback
  if (window.ttsScreenWakeSyncPending) {
    console.log('[calculatePages] BLOCKED - Screen wake sync pending');
    return;
  }

  // CRITICAL: Allow initial scroll to complete, then debounce subsequent calls
  const needsInitialScroll =
    !reader.hasPerformedInitialScroll &&
    !reader.initialScrollPending &&
    initialReaderConfig.savedParagraphIndex !== undefined &&
    initialReaderConfig.savedParagraphIndex >= 0;

  // Allow first calculatePages call for initial scroll, then debounce subsequent calls
  const isFirstCall = window.lastCalculatePagesCall === 0;
  const timeSinceLastCall = now - window.lastCalculatePagesCall;

  if (
    !needsInitialScroll &&
    !isFirstCall &&
    timeSinceLastCall < CALCULATE_PAGES_DEBOUNCE
  ) {
    console.log(
      '[calculatePages] BLOCKED - Debounced (',
      timeSinceLastCall,
      'ms)',
    );
    return;
  }

  // Update call timestamp
  window.lastCalculatePagesCall = now;

  // IMMEDIATE TTS PROTECTION: Block if any TTS operation is active
  if (
    window.ttsOperationActive ||
    (window.tts && (window.tts.reading || window.tts.cleanupInProgress))
  ) {
    console.log('[calculatePages] BLOCKED - TTS operation active');
    return;
  }

  // COOLDOWN CHECK: Block if TTS operation ended recently (within 1 second)
  const timeSinceTTSOperation = now - window.ttsOperationEndTime;
  if (timeSinceTTSOperation < 1000) {
    console.log(
      '[calculatePages] BLOCKED - TTS operation cooldown (',
      timeSinceTTSOperation,
      'ms)',
    );
    return;
  }

  // CONTROLLER DRAG CHECK: Block if TTS controller is being dragged
  const controller = document.getElementById('TTS-Controller');
  if (
    controller &&
    (controller.dataset.dragging === 'true' ||
      controller.dataset.cleanupInProgress === 'true')
  ) {
    console.log('[calculatePages] BLOCKED - TTS controller drag in progress');
    return;
  }

  // CRITICAL: Block additional calculatePages calls if initial scroll already completed
  // This prevents ResizeObserver from triggering unwanted scrolls after TTS operations
  if (
    reader.hasPerformedInitialScroll &&
    initialReaderConfig.savedParagraphIndex !== undefined &&
    initialReaderConfig.savedParagraphIndex >= 0
  ) {
    console.log('[calculatePages] BLOCKED - Initial scroll already performed');
    return;
  }

  reader.refresh();

  if (reader.generalSettings.val.pageReader) {
    pageReader.totalPages.val = parseInt(
      (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
        reader.layoutWidth,
      10,
    );

    if (initialPageReaderConfig.nextChapterScreenVisible) return;

    pageReader.movePage(
      Math.max(
        0,
        Math.round(
          (pageReader.totalPages.val * reader.chapter.progress) / 100,
        ) - 1,
      ),
    );
  } else {
    // NEW SCROLL LOGIC
    if (
      !reader.hasPerformedInitialScroll &&
      initialReaderConfig.savedParagraphIndex !== undefined &&
      initialReaderConfig.savedParagraphIndex >= 0
    ) {
      const readableElements = reader.getReadableElements();
      console.log(
        '[calculatePages] readableElements length:',
        readableElements.length,
      );

      if (readableElements[initialReaderConfig.savedParagraphIndex]) {
        reader.initialScrollPending = true; // Set pending flag
        console.log(
          '[calculatePages] Scrolling to paragraph',
          initialReaderConfig.savedParagraphIndex,
          'hasPerformedInitialScroll:',
          reader.hasPerformedInitialScroll,
          'timeSinceLastCall:',
          Date.now() - window.lastCalculatePagesCall,
        );

        reader.suppressSaveOnScroll = true;

        // Wait for layout to be fully stable (fonts, images, etc.)
        setTimeout(() => {
          const target =
            readableElements[initialReaderConfig.savedParagraphIndex];
          if (!target || !target.isConnected) {
            console.warn(
              '[calculatePages] Target element disconnected, aborting scroll',
            );
            reader.initialScrollPending = false; // Reset pending flag
            reader.hasPerformedInitialScroll = true;
            reader.suppressSaveOnScroll = false;
            return;
          }

          // Simple and reliable: Just use scrollIntoView
          target.scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'nearest',
          });

          console.log(
            '[calculatePages] Scrolled to paragraph',
            initialReaderConfig.savedParagraphIndex,
          );

          // Verify by checking if element is in viewport (the RIGHT way)
          setTimeout(() => {
            const rect = target.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
            const isPartiallyVisible =
              rect.top < viewportHeight && rect.bottom > 0;

            console.log(
              '[calculatePages] Element position: top=',
              rect.top,
              'bottom=',
              rect.bottom,
              'visible=',
              isVisible || isPartiallyVisible,
            );

            console.log('[calculatePages] Initial scroll complete');

            // Set a marker to block processScroll saves for a longer grace period
            // This prevents stale scroll events from saving wrong positions
            reader.initialScrollCompleteTime = Date.now();

            // Reset flags
            reader.suppressSaveOnScroll = false;
            reader.initialScrollPending = false;
            reader.hasPerformedInitialScroll = true;

            try {
              reader.post({
                type: 'initial-scroll-complete',
                paragraphIndex: initialReaderConfig.savedParagraphIndex,
                chapterId: reader.chapter.id,
                ts: Date.now(),
              });
            } catch (e) {
              console.warn(
                '[calculatePages] Failed to post initial-scroll-complete',
                e,
              );
            }
          }, 300);
        }, 250); // Increased delay for layout stability

        return;
      } else {
        console.log(
          '[calculatePages] Paragraph not found at index',
          initialReaderConfig.savedParagraphIndex,
        );
      }
    } else if (!reader.hasPerformedInitialScroll) {
      console.log(
        '[calculatePages] No valid savedParagraphIndex or already scrolled',
      );
      reader.hasPerformedInitialScroll = true;
    }

    const shouldScrollToProgress = !window.tts || !window.tts.reading;

    if (shouldScrollToProgress) {
      // NEW: Comprehensive TTS protection for progress scroll

      // Block progress scroll during any TTS-related operation
      if (
        window.ttsOperationActive ||
        (window.tts && (window.tts.reading || window.tts.cleanupInProgress)) ||
        timeSinceTTSOperation < 1000 ||
        (controller &&
          (controller.dataset.dragging === 'true' ||
            controller.dataset.cleanupInProgress === 'true'))
      ) {
        console.log(
          '[calculatePages] Progress scroll blocked - TTS operation protection',
        );
        return;
      }

      setTimeout(() => {
        console.log(
          '[calculatePages] PROGRESS SCROLL EXECUTING - progress:',
          reader.chapter.progress,
          'hasPerformedInitialScroll:',
          reader.hasPerformedInitialScroll,
        );
        window.scrollTo({
          top:
            (reader.chapterHeight * reader.chapter.progress) / 100 -
            reader.layoutHeight,
          behavior: 'smooth',
        });
      }, 100);
    } else {
      console.log(
        '[calculatePages] Skipping progress scroll - TTS currently reading',
      );
    }
  }
}

// Global TTS operation tracking
window.ttsOperationActive = false;
window.ttsOperationEndTime = 0;
// BUG FIX: Track when TTS stops to implement grace period for scroll saves
window.ttsLastStopTime = 0;
// BUG 3 FIX: Screen wake sync flag - set by RN when screen wakes during background TTS
window.ttsScreenWakeSyncPending = false;

// Global ResizeObserver debounce tracking
window.lastCalculatePagesCall = 0;
const CALCULATE_PAGES_DEBOUNCE = 500; // 500ms minimum between calls

// Prevent ResizeObserver from calling calculatePages inappropriately
const ro = new ResizeObserver(() => {
  // BUG 3 FIX: Block during screen wake sync
  if (window.ttsScreenWakeSyncPending) {
    console.log('[ResizeObserver] BLOCKED - Screen wake sync pending');
    return;
  }

  // DEBOUNCE CHECK: Allow first ResizeObserver call, then block excessive calls
  const now = Date.now();
  const isFirstCall = window.lastCalculatePagesCall === 0;

  // CRITICAL: Allow initial scroll to complete, then debounce subsequent calls
  const needsInitialScroll =
    !reader.hasPerformedInitialScroll &&
    !reader.initialScrollPending &&
    initialReaderConfig.savedParagraphIndex !== undefined &&
    initialReaderConfig.savedParagraphIndex >= 0;

  const timeSinceLastCall = now - window.lastCalculatePagesCall;
  if (
    !needsInitialScroll &&
    !isFirstCall &&
    timeSinceLastCall < CALCULATE_PAGES_DEBOUNCE
  ) {
    console.log(
      '[ResizeObserver] BLOCKED - Debounced (',
      timeSinceLastCall,
      'ms)',
    );
    return;
  }

  // IMMEDIATE CHECK: Block if any TTS operation is active
  if (
    window.ttsOperationActive ||
    (window.tts && (window.tts.reading || window.tts.cleanupInProgress))
  ) {
    console.log('[ResizeObserver] BLOCKED - TTS operation active');
    return;
  }

  // COOLDOWN CHECK: Block if TTS operation ended recently (within 1 second)
  const timeSinceTTSOperation = now - window.ttsOperationEndTime;
  if (timeSinceTTSOperation < 1000) {
    console.log(
      '[ResizeObserver] BLOCKED - TTS operation cooldown (',
      timeSinceTTSOperation,
      'ms)',
    );
    return;
  }

  // CONTROLLER DRAG CHECK: Block if TTS controller is being dragged
  const controller = document.getElementById('TTS-Controller');
  if (
    controller &&
    (controller.dataset.dragging === 'true' ||
      controller.dataset.cleanupInProgress === 'true')
  ) {
    console.log('[ResizeObserver] BLOCKED - TTS controller drag in progress');
    return;
  }

  // Update last call timestamp
  window.lastCalculatePagesCall = now;

  console.log('[ResizeObserver] TRIGGERED! Stack:', new Error().stack);
  console.log(
    '[ResizeObserver] Trigger state - TTS Reading:',
    window.tts && window.tts.reading,
  );
  console.log(
    '[ResizeObserver] Trigger state - TTS Cleanup:',
    window.tts && window.tts.cleanupInProgress,
  );
  console.log(
    '[ResizeObserver] TTS Operation Active:',
    window.ttsOperationActive,
  );

  if (
    window.tts &&
    (window.tts.reading ||
      window.tts.cleanupInProgress ||
      window.ttsOperationActive)
  ) {
    console.log(
      '[ResizeObserver] TRIGGERED during TTS operation - Potential race condition',
    );
  }

  // Always call calculatePages - it will handle both pageReader and scroll modes appropriately
  calculatePages();

  // If we haven't performed initial scroll yet, add an extra delayed call to ensure it happens
  if (
    !reader.hasPerformedInitialScroll &&
    initialReaderConfig.savedParagraphIndex !== undefined &&
    initialReaderConfig.savedParagraphIndex >= 0
  ) {
    // Add delay to avoid interrupting ongoing initial scroll
    setTimeout(() => {
      // Re-check all TTS flags after delay
      if (
        !reader.hasPerformedInitialScroll &&
        !reader.isUserScrolling &&
        !window.ttsOperationActive &&
        !(window.tts && (window.tts.reading || window.tts.cleanupInProgress)) &&
        (!controller ||
          (controller.dataset.dragging !== 'true' &&
            controller.dataset.cleanupInProgress !== 'true'))
      ) {
        console.log(
          '[ResizeObserver] Calling calculatePages again for initial scroll',
        );
        calculatePages();
      } else {
        console.log(
          '[ResizeObserver] Initial scroll blocked - TTS operation or scroll in progress detected',
        );
      }
    }, 200); // Increased delay for better protection
  }
});
ro.observe(reader.chapterElement);

// Also call once on load
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    requestAnimationFrame(() => setTimeout(calculatePages, 0));
  });
});

// Receive messages from React Native to update settings live
const __handleNativeMessage = ev => {
  let payload = ev && ev.data ? ev.data : ev;
  try {
    if (typeof payload === 'string') payload = JSON.parse(payload);
  } catch (e) {
    // ignore non-json messages
  }

  if (!payload || !payload.type) return;

  try {
    if (payload.type === 'set-general-settings' && payload.data) {
      // Merge shallowly into existing generalSettings value
      reader.generalSettings.val = Object.assign(
        {},
        reader.generalSettings.val,
        payload.data,
      );
    } else if (payload.type === 'tts-update-settings' && payload.data) {
      if (window.tts && typeof window.tts.applySettings === 'function') {
        window.tts.applySettings(payload.data);
      }
    }
  } catch (e) {
    console.warn('__handleNativeMessage error', e);
  }
};

window.addEventListener('message', __handleNativeMessage);
// Some WebView implementations also emit 'message' on document
document.addEventListener('message', __handleNativeMessage);

// click handler
(function () {
  const detectTapPosition = (x, y, horizontal) => {
    if (horizontal) {
      if (x < 0.33) {
        return 'left';
      }
      if (x > 0.66) {
        return 'right';
      }
    } else {
      if (y < 0.33) {
        return 'top';
      }
      if (y > 0.66) {
        return 'bottom';
      }
    }
    return 'center';
  };
  document.onclick = e => {
    const { clientX, clientY } = e;
    const { x, y } = {
      x: clientX / reader.layoutWidth,
      y: clientY / reader.layoutHeight,
    };

    // NEW: Check cooldown period
    const timeSinceLastScroll =
      Date.now() - (window.tts?.lastAutoScrollTime || 0);
    if (window.tts && timeSinceLastScroll < window.tts.SCROLL_COOLDOWN) {
      console.log('TTS: Click blocked during scroll cooldown');
      return;
    }

    // NEW: Don't process clicks during TTS auto-scroll
    if (window.tts && window.tts.isAutoScrolling) {
      console.log('TTS: Click ignored during auto-scroll');
      return; // Prevent settings toggle during TTS scroll animation
    }

    if (reader.generalSettings.val.pageReader) {
      const position = detectTapPosition(x, y, true);
      if (position === 'left') {
        pageReader.movePage(pageReader.page.val - 1);
        return;
      }
      if (position === 'right') {
        pageReader.movePage(pageReader.page.val + 1);
        return;
      }
    } else {
      if (reader.generalSettings.val.tapToScroll) {
        const position = detectTapPosition(x, y, false);

        // Allow tap-to-scroll during TTS (follow mode)

        if (position === 'top') {
          window.scrollBy({
            top: -reader.layoutHeight * 0.75,
            behavior: 'smooth',
          });
          return;
        }
        if (position === 'bottom') {
          window.scrollBy({
            top: reader.layoutHeight * 0.75,
            behavior: 'smooth',
          });
          return;
        }
      }
    }

    // Only toggle settings if clicking center
    reader.post({ type: 'hide' });
  };
})();

// swipe handler
(function () {
  this.initialX = null;
  this.initialY = null;

  reader.chapterElement.addEventListener('touchstart', e => {
    this.initialX = e.changedTouches[0].screenX;
    this.initialY = e.changedTouches[0].screenY;
  });

  reader.chapterElement.addEventListener('touchmove', e => {
    if (reader.generalSettings.val.pageReader) {
      const diffX =
        (e.changedTouches[0].screenX - this.initialX) / reader.layoutWidth;
      reader.chapterElement.style.transition = 'unset';
      reader.chapterElement.style.transform =
        'translateX(-' + (pageReader.page.val - diffX) * 100 + '%)';
    }
  });

  reader.chapterElement.addEventListener('touchend', e => {
    const diffX = e.changedTouches[0].screenX - this.initialX;
    const diffY = e.changedTouches[0].screenY - this.initialY;
    if (reader.generalSettings.val.pageReader) {
      reader.chapterElement.style.transition = '200ms';
      const diffXPercentage = diffX / reader.layoutWidth;
      if (diffXPercentage < -0.3) {
        pageReader.movePage(pageReader.page.val + 1);
      } else if (diffXPercentage > 0.3) {
        pageReader.movePage(pageReader.page.val - 1);
      } else {
        pageReader.movePage(pageReader.page.val);
      }
      return;
    }
    if (
      e.target.id?.startsWith('scrollbar') ||
      e.target.id === 'Image-Modal-img'
    ) {
      return;
    }
    if (
      reader.generalSettings.val.swipeGestures &&
      Math.abs(diffX) > Math.abs(diffY) * 2 &&
      Math.abs(diffX) > 180
    ) {
      if (diffX < 0 && this.initialX >= window.innerWidth / 2) {
        e.preventDefault();
        reader.post({ type: 'next' });
      } else if (diffX > 0 && this.initialX <= window.innerWidth / 2) {
        e.preventDefault();
        reader.post({ type: 'prev' });
      }
    }
  });
})();

// text options
(function () {
  // Track previous settings to detect real changes
  let prevBionicReading = reader.generalSettings.val.bionicReading;
  let prevRemoveSpacing =
    reader.generalSettings.val.removeExtraParagraphSpacing;

  van.derive(() => {
    const currentBionic = reader.generalSettings.val.bionicReading;
    const currentSpacing =
      reader.generalSettings.val.removeExtraParagraphSpacing;

    // CRITICAL: Only rebuild DOM if text-affecting settings changed
    const needsRebuild =
      currentBionic !== prevBionicReading ||
      currentSpacing !== prevRemoveSpacing;

    console.log(
      `Text options: Check rebuild. Bionic: ${prevBionicReading}->${currentBionic}, Spacing: ${prevRemoveSpacing}->${currentSpacing}. Needs rebuild: ${needsRebuild}`,
    );

    if (!needsRebuild) {
      console.log('Text options: Skipping DOM rebuild (no relevant changes)');
      return; // Exit early - don't touch the DOM
    }

    console.log('Text options: Rebuilding DOM due to bionic/spacing change');

    // Update tracking
    prevBionicReading = currentBionic;
    prevRemoveSpacing = currentSpacing;

    let html = reader.rawHTML;
    if (currentBionic) {
      html = textVide.textVide(reader.rawHTML);
    }

    if (currentSpacing) {
      html = html
        .replace(/(?:&nbsp;\s*|[\u200b]\s*)+(?=<\/?p[> ])/g, '')
        .replace(/<br>\s*<br>\s*(?:<br>\s*)+/g, '<br><br>') //force max 2 consecutive <br>, chaining regex
        .replace(
          /<br>\s*<br>[^]+/,
          _ =>
            `${
              /\/p>/.test(_)
                ? _.replace(
                    /<br>\s*<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p\b[^>]*><br>\s*<br>))\s*/g,
                    '',
                  )
                : _
            } `,
        ) //if p found, delete all double br near p
        .replace(/<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p>\s*<br>))\s*/g, '');
    }

    // CRITICAL: Save TTS state before DOM rebuild
    const wasTTSReading = window.tts && window.tts.reading;
    let savedTTSState = null;

    if (wasTTSReading) {
      const readableElements = reader.getReadableElements();
      const currentIndex = readableElements.indexOf(window.tts.currentElement);

      savedTTSState = {
        paragraphIndex: currentIndex,
        wasReading: true,
        scrollY: window.scrollY,
      };

      console.log(
        'Text options: Saved TTS state before rebuild:',
        savedTTSState,
      );

      // Pause TTS before DOM manipulation
      window.tts.pause();
    }

    reader.chapterElement.innerHTML = html;

    // CRITICAL: Restore TTS state after DOM rebuild
    if (savedTTSState && savedTTSState.paragraphIndex >= 0) {
      // Invalidate cache to force re-scan
      reader.invalidateCache();

      setTimeout(() => {
        const newElements = reader.getReadableElements();

        if (newElements[savedTTSState.paragraphIndex]) {
          window.tts.currentElement = newElements[savedTTSState.paragraphIndex];
          window.tts.prevElement =
            newElements[savedTTSState.paragraphIndex - 1] || null;
          window.tts.started = true;

          // Restore scroll position
          window.scrollTo({ top: savedTTSState.scrollY, behavior: 'auto' });

          console.log(
            'Text options: Restored TTS to paragraph',
            savedTTSState.paragraphIndex,
          );

          // Resume if it was playing
          if (savedTTSState.wasReading) {
            window.tts.resume(true); // forceResume=true to skip scroll check
          }
        } else {
          console.error(
            'Text options: Failed to restore TTS - paragraph not found',
          );
        }
      }, 300); // Wait for layout
    }
  });
})();
