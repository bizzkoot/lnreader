const { div, img, button } = van.tags;


const ChapterEnding = () => {
  return () =>
    reader.generalSettings.val.pageReader
      ? div()
      : div(div({ class: 'info-text' }, reader.strings.finished), () =>
        reader.nextChapter
          ? button(
            {
              class: 'next-button',
              onclick: e => {
                e.stopPropagation();
                reader.post({ type: 'next' });
              },
            },
            reader.strings.nextChapter,
          )
          : div({ class: 'info-text' }, reader.strings.noNextChapter),
      );
};

const Scrollbar = () => {
  const horizontal = van.derive(
    () => !reader.generalSettings.val.verticalSeekbar,
  );
  let lock = false;
  const percentage = van.state(0);
  const update = ratio => {
    if (ratio === undefined) {
      ratio = (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
    }
    if (ratio > 1) {
      ratio = 1;
    }
    if (reader.generalSettings.val.pageReader) {
      pageReader.movePage(
        parseInt(pageReader.totalPages.val * Math.min(0.99, ratio), 10),
      );
      return;
    }
    percentage.val = parseInt(ratio * 100, 10);
    if (lock) {
      window.scrollTo({
        top: reader.chapterHeight * ratio - reader.layoutHeight,
        behavior: 'instant',
      });
    }
  };
  window.addEventListener(
    'scroll',
    () => !lock && !reader.generalSettings.val.pageReader && update(),
  );
  return div(
    { id: 'ScrollBar' },
    div(
      { class: 'scrollbar-item scrollbar-text', id: 'scrollbar-percentage' },
      () =>
        reader.generalSettings.val.pageReader
          ? pageReader.page.val + 1
          : percentage.val,
    ),
    div(
      { class: 'scrollbar-item', id: 'scrollbar-slider' },
      div(
        { id: 'scrollbar-track' },
        div(
          {
            id: 'scrollbar-progress',
            style: () => {
              const percentageValue = reader.generalSettings.val.pageReader
                ? ((pageReader.page.val + 1) / pageReader.totalPages.val) * 100
                : percentage.val;
              return horizontal.val
                ? `width: ${percentageValue}%; height: 100%;`
                : `height: ${percentageValue}%; width: 100%;`;
            },
          },
          div(
            {
              id: 'scrollbar-thumb-wrapper',
              ontouchstart: () => {
                lock = true;
              },
              ontouchend: () => {
                lock = false;
              },
              ontouchmove: function (e) {
                const slider = this.parentElement.parentElement.parentElement;
                const sliderHeight = horizontal.val
                  ? slider.clientWidth
                  : slider.clientHeight;
                const sliderOffsetY = horizontal.val
                  ? slider.getBoundingClientRect().left
                  : slider.getBoundingClientRect().top;
                const ratio =
                  ((horizontal.val
                    ? e.changedTouches[0].clientX
                    : e.changedTouches[0].clientY) -
                    sliderOffsetY) /
                  sliderHeight;
                update(ratio < 0 ? 0 : ratio);
              },
            },
            div({ id: 'scrollbar-thumb' }),
          ),
        ),
      ),
    ),
    div(
      {
        class: 'scrollbar-item scrollbar-text',
        id: 'scrollbar-percentage-max',
      },
      () =>
        reader.generalSettings.val.pageReader ? pageReader.totalPages.val : 100,
    ),
  );
};

const ToolWrapper = () => {
  const horizontal = van.derive(
    () => !reader.generalSettings.val.verticalSeekbar,
  );
  return div(
    {
      id: 'ToolWrapper',
      class: () =>
        `${reader.hidden.val ? 'hidden' : ''} ${horizontal.val ? 'horizontal' : ''
        }`,
    },
    Scrollbar(),
  );
};

const ImageModal = ({ src }) => {
  return div(
    {
      id: 'Image-Modal',
      class: () => (src.val ? 'show' : ''),
      onclick: e => {
        if (e.target.id !== 'Image-Modal-img') {
          e.stopPropagation();
          src.val = '';
        }
      },
    },
    img({
      id: 'Image-Modal-img',
      src: src,
      alt: () => (src.val ? `Cant not render image from ${src.val}` : ''),
    }),
  );
};

const ModalWrapper = () => {
  const imgSrc = van.state('');
  const showImage = src => {
    imgSrc.val = src;
    reader.viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=10',
    );
  };
  const hideImage = () => {
    imgSrc.val = '';
    reader.viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0',
    );
  };

  document.addEventListener('contextmenu', e => {
    if (e.target instanceof HTMLImageElement) {
      if (!imgSrc.val) {
        showImage(e.target.src);
      } else {
        hideImage();
      }
    }
  });
  return div(ImageModal({ src: imgSrc }));
};

const Footer = () => {
  const percentage = van.state(0);
  const time = van.state(
    new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  );
  window.addEventListener('scroll', () => {
    let ratio = (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
    if (ratio > 1) {
      ratio = 1;
    }
    percentage.val = parseInt(ratio * 100, 10);
  });
  setInterval(() => {
    time.val = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }, 10000);
  return div(
    {
      id: 'reader-footer-wrapper',
      class: () =>
        reader.generalSettings.val.showBatteryAndTime ||
          reader.generalSettings.val.showScrollPercentage
          ? ''
          : 'd-none',
    },
    div(
      { id: 'reader-footer' },

      div(
        {
          id: 'reader-battery',
          class: () =>
            `reader-footer-item ${reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        () => Math.ceil(reader.batteryLevel.val * 100) + '%',
      ),
      div(
        {
          id: 'reader-percentage',
          class: () =>
            `reader-footer-item ${reader.generalSettings.val.showScrollPercentage ? '' : 'hidden'
            }`,
        },
        () =>
          reader.generalSettings.val.pageReader
            ? `${pageReader.page.val + 1}/${pageReader.totalPages.val}`
            : percentage.val + '%',
      ),
      div(
        {
          id: 'reader-time',
          class: () =>
            `reader-footer-item ${reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        time,
      ),
    ),
  );
};



// Safe storage helper to handle SecurityError
const SafeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {

      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {

    }
  }
};

const TTSController = () => {

  try {
    let controllerElement = null;
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Restore saved position with validation
    // Priority: 1. In-memory/Session (SafeStorage) 2. Native Persisted (initialReaderConfig)
    let savedLeft = SafeStorage.getItem('tts-controller-left');
    let savedTop = SafeStorage.getItem('tts-controller-top');

    if (!savedLeft && initialReaderConfig.ttsButtonPosition) {
      savedLeft = initialReaderConfig.ttsButtonPosition.left;
      savedTop = initialReaderConfig.ttsButtonPosition.top;
    }

    if (savedLeft && savedTop) {
      const leftVal = parseInt(savedLeft, 10);
      const topVal = parseInt(savedTop, 10);
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Basic validation: must be within screen bounds (allowing for some margin)
      if (leftVal < 0 || leftVal > windowWidth - 20 || topVal < 0 || topVal > windowHeight - 20) {
        savedLeft = null;
        savedTop = null;
      }
    }

    return div(
      {
        id: 'TTS-Controller',
        class: () => reader.generalSettings.val.TTSEnable ? '' : 'hidden',
        style: () => {
          // Skip ALL style updates during any drag operation to prevent ResizeObserver triggering
          if (controllerElement && (controllerElement.dataset.dragging === 'true' || controllerElement.dataset.cleanupInProgress === 'true')) {
            return 'transform: none;'; // Ensure clean state for transform positioning
          }
          if (savedLeft && savedTop) {
            return `left: ${savedLeft}; top: ${savedTop};`;
          }
          // Default to left-center (9 o'clock position)
          return 'left: 15px; top: calc(50% - 25px);';
        },
        ontouchstart: (e) => {
          if (!controllerElement) {
            controllerElement = document.getElementById('TTS-Controller');
          }

          // Only handle if touching the controller itself
          if (e.target.closest('#TTS-Controller')) {
            // CRITICAL: Set global TTS operation flag IMMEDIATELY on touchstart
            // This prevents ResizeObserver from firing before we detect drag
            window.ttsOperationActive = true;

            isDragging = false; // Will be set to true if movement detected
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            const rect = controllerElement.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            controllerElement.classList.add('active');
            controllerElement.style.transition = 'none'; // Disable transition during drag

            // Prevent default to stop scroll during potential drag
            e.stopPropagation();
          }
        },
        ontouchmove: (e) => {
          if (startX === undefined) return;

          const deltaX = e.touches[0].clientX - startX;
          const deltaY = e.touches[0].clientY - startY;

          // Consider it a drag if moved more than 5px
          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            isDragging = true;
            controllerElement.dataset.dragging = 'true';

            // Update position with boundary constraints
            const buttonWidth = controllerElement.offsetWidth;
            const buttonHeight = controllerElement.offsetHeight;

            const newLeft = Math.max(0, Math.min(initialLeft + deltaX, window.innerWidth - buttonWidth));
            const newTop = Math.max(0, Math.min(initialTop + deltaY, window.innerHeight - buttonHeight));

            // Apply transform directly to DOM element to bypass reactivity system
            controllerElement.style.transform = `translate(${newLeft}px, ${newTop}px)`;
            controllerElement.style.left = '0px';
            controllerElement.style.top = '0px';

            // CRITICAL: Prevent scroll propagation
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();
          }
        },
        ontouchend: (e) => {
          if (isDragging) {
            // Prevent click event from firing after drag
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();

            // Set cleanup flag to prevent style function from interfering
            controllerElement.dataset.cleanupInProgress = 'true';

            // Get the final position from the current transform
            const rect = controllerElement.getBoundingClientRect();
            const finalLeft = rect.left;
            const finalTop = rect.top;

            // Save final position to local variables for the style binding
            savedLeft = finalLeft + 'px';
            savedTop = finalTop + 'px';

            // Save position to SafeStorage (Session)
            SafeStorage.setItem('tts-controller-left', savedLeft);
            SafeStorage.setItem('tts-controller-top', savedTop);

            // Save position to Native (Persistent)
            reader.post({
              type: 'save-tts-position',
              data: {
                left: savedLeft,
                top: savedTop
              }
            });

            // CRITICAL: Remove active class immediately to fix visual issue
            controllerElement.classList.remove('active');

            // Clear transform and switch to left/top positioning
            controllerElement.style.transform = 'none';
            controllerElement.style.left = savedLeft;
            controllerElement.style.top = savedTop;
            controllerElement.style.transition = '0.5s'; // Restore transition for future changes

            // Clear all flags and global operation state after delay
            setTimeout(() => {
              if (controllerElement) {
                delete controllerElement.dataset.cleanupInProgress;
                delete controllerElement.dataset.dragging;
              }
              window.ttsOperationActive = false;
              window.ttsOperationEndTime = Date.now(); // Set cooldown timestamp
            }, 300);

            return; // Exit early to prevent the general touchend logic
          }

          // If not dragging, clear the operation flag immediately
          // This happens for simple taps on TTS button
          window.ttsOperationActive = false;

          if (controllerElement) {
            // Only remove active class if we weren't dragging
            if (controllerElement.dataset.dragging !== 'true') {
              controllerElement.classList.remove('active');
            }
            controllerElement.style.transition = '0.5s'; // Restore transition
          }

          // Reset
          isDragging = false;
          startX = undefined;
          startY = undefined;
        },
        onclick: e => {
          e.stopPropagation();
          
          // Set TTS operation flag to prevent ResizeObserver during click processing
          window.ttsOperationActive = true;
          
          // If we were dragging, don't toggle playback
          if (controllerElement && controllerElement.dataset.dragging === 'true') {
            window.ttsOperationActive = false;
            return;
          }

          if (tts.reading) {
            tts.pause();
            controllerElement.firstElementChild.innerHTML = tts.resumeIcon;
          } else {
            tts.resume();
            controllerElement.firstElementChild.innerHTML = tts.pauseIcon;
          }

          // Clear operation flag after a brief delay for click processing
          setTimeout(() => {
            window.ttsOperationActive = false;
            window.ttsOperationEndTime = Date.now();
          }, 200);
        },
      },
      button({ innerHTML: tts.volumeIcon || 'TTS' }),
    );
  } catch (e) {

    return div();
  }
};

const ReaderUI = () => {
  return div(
    ToolWrapper(),
    TTSController(),
    ModalWrapper(),
    Footer(),
    ChapterEnding(),
  );
};

van.add(document.getElementById('reader-ui'), ReaderUI());
