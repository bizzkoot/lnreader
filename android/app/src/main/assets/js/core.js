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

  this.post = obj => window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  this.refresh = () => {
    if (this.generalSettings.val.pageReader) {
      this.chapterWidth = this.chapterElement.scrollWidth;
    } else {
      this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
    }
  };

  van.derive(() => {
    const settings = this.readerSettings.val;
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

  this.getReadableElements = () => {
    const elements = [];
    const traverse = (node) => {
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
    traverse(this.chapterElement);
    return elements;
  };

  document.onscrollend = () => {
    if (!this.generalSettings.val.pageReader) {
      const readableElements = this.getReadableElements();
      let paragraphIndex = -1;
      for (let i = 0; i < readableElements.length; i++) {
        if (window.tts.isElementInViewport(readableElements[i])) {
          paragraphIndex = i;
          break;
        }
      }

      this.post({
        type: 'save',
        data: parseInt(
          ((window.scrollY + this.layoutHeight) / this.chapterHeight) * 100,
          10,
        ),
        paragraphIndex,
      });
    }
  };

  if (DEBUG) {
    // eslint-disable-next-line no-global-assign, no-new-object
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
    'FOOTER'
  ];
  this.prevElement = null;
  this.currentElement = reader.chapterElement;
  this.started = false;
  this.reading = false;

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
        const controller = document.getElementById('TTS-Controller');
        if (controller?.firstElementChild) {
          controller.firstElementChild.innerHTML = volumnIcon;
        }
        if (reader.nextChapter) {
          reader.post({ type: 'next', autoStartTTS: true });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  this.restoreState = (config) => {
    console.log('TTS: Restore state called with config:', config);

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
      console.log('TTS: Resuming from paragraph index:', paragraphIndex);

      this.hasAutoResumed = true;
      this.currentElement = readableElements[paragraphIndex];
      this.scrollToElement(this.currentElement);

      if (config.autoStart) {
        console.log('TTS: Auto-starting playback');
        setTimeout(() => {
          this.next();
        }, 500);
      } else {
        console.log('TTS: Positioned at paragraph but not auto-starting');
        this.currentElement.classList.add('highlight');
        reader.post({
          type: 'tts-positioned',
          data: { paragraphIndex }
        });
      }
    } else {
      console.log('TTS: Paragraph not found, starting from beginning');
      this.start();
    }
  };

  this.hasAutoResumed = false;

  this.start = element => {
    this.stop();
    if (element) {
      console.log('TTS: Starting from specific element');
      this.currentElement = element;
    } else {
      const readableElements = reader.getReadableElements();
      const savedIndex = initialReaderConfig.savedParagraphIndex;

      console.log('TTS: Raw general settings:', JSON.stringify(reader.generalSettings.val));
      const autoResumeSetting = reader.generalSettings.val.ttsAutoResume || 'prompt';

      // Priority 1: Force Resume from Saved Index (First Run Only)
      // Only if setting is NOT 'never'. If 'prompt', we assume the user already approved via native prompt
      // or if they manually pressed play, we default to resuming.
      // But if 'never', we should skip this and start from visible.
      if (!this.hasAutoResumed && savedIndex !== undefined && savedIndex >= 0 && autoResumeSetting !== 'never') {
        if (readableElements[savedIndex]) {
          if (autoResumeSetting === 'prompt') {
            console.log('TTS: Requesting confirmation for resume');
            reader.post({
              type: 'request-tts-confirmation',
              data: { savedIndex: savedIndex }
            });
            return;
          }

          console.log('TTS: Force Resume - Starting from saved paragraph index:', savedIndex, 'Setting:', autoResumeSetting);
          this.hasAutoResumed = true;
          this.currentElement = readableElements[savedIndex];
          this.scrollToElement(this.currentElement);
          this.next();
          return;
        } else {
          console.log('TTS: Saved index', savedIndex, 'not found in readableElements of length', readableElements.length);
        }
      } else {
        console.log('TTS: Skipping resume. hasAutoResumed:', this.hasAutoResumed, 'savedIndex:', savedIndex, 'Setting:', autoResumeSetting);
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
          rect.top < (window.innerHeight || document.documentElement.clientHeight)
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
        console.log('TTS: Found best visible element:', bestElement.textContent.substring(0, 20));
        this.currentElement = bestElement;
      } else {
        console.log('TTS: No visible element found, starting from beginning');
        this.currentElement = reader.chapterElement;
      }
    }
    this.next();
  };

  this.resume = () => {
    if (!this.reading) {
      if (
        this.started &&
        this.currentElement &&
        this.currentElement.id !== 'LNReader-chapter'
      ) {
        this.speak();
        this.reading = true;
      } else {
        this.start();
      }
    }
  };

  this.pause = () => {
    this.reading = false;
    reader.post({ type: 'stop-speak' });

    const readableElements = reader.getReadableElements();
    const paragraphIndex = readableElements.indexOf(this.currentElement);

    reader.post({
      type: 'tts-state',
      data: {
        isReading: false,
        paragraphIndex: paragraphIndex
      }
    });
  };

  this.stop = () => {
    reader.post({ type: 'stop-speak' });
    this.currentElement?.classList?.remove('highlight');
    this.prevElement = null;
    this.currentElement = reader.chapterElement;
    this.started = false;
    this.reading = false;
    reader.post({ type: 'tts-state', data: { isReading: false } });
  };

  this.isElementInViewport = element => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const windowWidth =
      window.innerWidth || document.documentElement.clientWidth;

    // Check for partial visibility
    return (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0
    );
  };

  this.scrollToElement = element => {
    if (!element) return;
    // Check if element is partially visible (at least some part is in viewport)
    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const isPartiallyVisible =
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    // Only scroll if element is not visible or barely visible
    if (!isPartiallyVisible || rect.top < 0 || rect.bottom > windowHeight) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  };

  this.speak = () => {
    if (!this.currentElement) return;
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
          ((window.scrollY + reader.layoutHeight) / reader.chapterHeight) * 100,
          10,
        ),
        paragraphIndex,
      });
    }

    // Use textContent to ensure indices match for highlighting
    const text = this.currentElement.textContent;
    if (text && text.trim().length > 0) {
      console.log('TTS: Speaking', text.substring(0, 20));
      reader.post({ type: 'speak', data: text });
      reader.post({
        type: 'tts-state',
        data: {
          isReading: true,
          paragraphIndex: paragraphIndex
        }
      });
    } else {
      this.next();
    }
  };

  this.highlightRange = (start, end) => {
    // Remove previous word highlights
    const highlights = this.currentElement.querySelectorAll('.word-highlight');
    highlights.forEach(h => {
      const parent = h.parentNode;
      while (h.firstChild) {
        parent.insertBefore(h.firstChild, h);
      }
      parent.removeChild(h);
      parent.normalize();
    });

    if (start < 0 || end <= start) return;

    const nodes = [];
    let charCount = 0;

    const traverse = (node) => {
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
    console.log('calculatePages: savedParagraphIndex =', initialReaderConfig.savedParagraphIndex);
    if (!reader.hasPerformedInitialScroll && initialReaderConfig.savedParagraphIndex !== undefined && initialReaderConfig.savedParagraphIndex >= 0) {
      const readableElements = reader.getReadableElements();
      console.log('calculatePages: readableElements length =', readableElements.length);
      if (readableElements[initialReaderConfig.savedParagraphIndex]) {
        console.log('calculatePages: Scrolling to paragraph', initialReaderConfig.savedParagraphIndex);
        reader.hasPerformedInitialScroll = true;
        setTimeout(() => {
          readableElements[initialReaderConfig.savedParagraphIndex].scrollIntoView({
            block: 'center',
            inline: 'nearest',
          });
        }, 100);
        return;
      } else {
        console.log('calculatePages: Paragraph not found at index', initialReaderConfig.savedParagraphIndex);
      }
    } else if (!reader.hasPerformedInitialScroll) {
      console.log('calculatePages: No valid savedParagraphIndex or already scrolled');
      reader.hasPerformedInitialScroll = true;
    }

    setTimeout(() => {
      window.scrollTo({
        top:
          (reader.chapterHeight * reader.chapter.progress) / 100 -
          reader.layoutHeight,
        behavior: 'smooth',
      });
    }, 100);
  }
}

const ro = new ResizeObserver(() => {
  if (pageReader.totalPages.val) {
    calculatePages();
  }
});
ro.observe(reader.chapterElement);

// Also call once on load
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    requestAnimationFrame(() => setTimeout(calculatePages, 0));
  });
});

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
  van.derive(() => {
    let html = reader.rawHTML;
    if (reader.generalSettings.val.bionicReading) {
      html = textVide.textVide(reader.rawHTML);
    }

    if (reader.generalSettings.val.removeExtraParagraphSpacing) {
      html = html
        .replace(/(?:&nbsp;\s*|[\u200b]\s*)+(?=<\/?p[> ])/g, '')
        .replace(/<br>\s*<br>\s*(?:<br>\s*)+/g, '<br><br>') //force max 2 consecutive <br>, chaining regex
        .replace(
          /<br>\s*<br>[^]+/,
          _ =>
            `${/\/p>/.test(_)
              ? _.replace(
                /<br>\s*<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p\b[^>]*><br>\s*<br>))\s*/g,
                '',
              )
              : _
            }`,
        ) //if p found, delete all double br near p
        .replace(/<br>(?:(?=\s*<\/?p[> ])|(?<=<\/?p>\s*<br>))\s*/g, '');
    }
    reader.chapterElement.innerHTML = html;
  });
})();
