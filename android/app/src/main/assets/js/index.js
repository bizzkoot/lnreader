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
        `${reader.hidden.val ? 'hidden' : ''} ${
          horizontal.val ? 'horizontal' : ''
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
            `reader-footer-item ${
              reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        () => Math.ceil(reader.batteryLevel.val * 100) + '%',
      ),
      div(
        {
          id: 'reader-percentage',
          class: () =>
            `reader-footer-item ${
              reader.generalSettings.val.showScrollPercentage ? '' : 'hidden'
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
            `reader-footer-item ${
              reader.generalSettings.val.showBatteryAndTime ? '' : 'hidden'
            }`,
        },
        time,
      ),
    ),
  );
};

// Safe storage helper to handle SecurityError
const SafeStorage = {
  getItem: key => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  },
};

// Offset badge helper functions
let offsetBadgeTimeout = null;

const showOffsetBadge = offset => {
  // Remove existing badge if any
  const existing = document.getElementById('TTS-OffsetBadge');
  if (existing) {
    existing.remove();
  }

  // Clear any existing timeout
  if (offsetBadgeTimeout) {
    clearTimeout(offsetBadgeTimeout);
    offsetBadgeTimeout = null;
  }

  // Get controller position and theme colors
  const controller = document.getElementById('TTS-Controller');
  if (!controller) return;

  const rect = controller.getBoundingClientRect();

  // Get theme colors from CSS variables
  const computedStyle = getComputedStyle(document.body);
  const themeColor =
    computedStyle.getPropertyValue('--readerSettings-theme').trim() ||
    'rgba(0, 0, 0, 0.85)';
  const textColor =
    computedStyle.getPropertyValue('--readerSettings-textColor').trim() ||
    '#fff';

  // Create badge element
  const badge = document.createElement('div');
  badge.id = 'TTS-OffsetBadge';
  badge.className = 'tts-offset-badge';

  // Position badge with boundary checks
  const badgeRight = rect.right + 10;
  const badgeLeft = rect.left - 10; // Anchor to left edge of the button
  const badgeTop = rect.top - 10;
  const badgeBottom = rect.bottom + 10;

  // Check if badge would overflow right edge
  if (badgeRight + 50 > window.innerWidth) {
    badge.style.left = badgeLeft + 'px';
    badge.classList.add('position-left');
  } else {
    badge.style.left = badgeRight + 'px';
    badge.classList.add('position-right');
  }

  // Check if badge would overflow top edge
  if (badgeTop - 30 < 0) {
    badge.style.top = badgeBottom + 'px';
  } else {
    badge.style.top = badgeTop + 'px';
  }

  const offsetText = offset > 0 ? `+${offset}` : offset.toString();
  badge.textContent = offsetText;

  // Apply theme colors
  badge.style.background = themeColor;
  badge.style.color = textColor;

  document.body.appendChild(badge);

  // Trigger fade-in animation via visible class
  requestAnimationFrame(() => {
    badge.classList.add('visible');
  });

  // Auto-hide after 3 seconds of inactivity (extended from 2s)
  offsetBadgeTimeout = setTimeout(() => {
    hideOffsetBadge();
  }, 3000);
};

const hideOffsetBadge = () => {
  const badge = document.getElementById('TTS-OffsetBadge');
  if (badge) {
    badge.remove();
  }
  if (offsetBadgeTimeout) {
    clearTimeout(offsetBadgeTimeout);
    offsetBadgeTimeout = null;
  }
};

const updateOffsetBadge = offset => {
  const badge = document.getElementById('TTS-OffsetBadge');
  if (badge) {
    const offsetText = offset > 0 ? `+${offset}` : offset.toString();
    badge.textContent = offsetText;
    // Reset the auto-hide timeout (extended to 3s to match showOffsetBadge)
    if (offsetBadgeTimeout) {
      clearTimeout(offsetBadgeTimeout);
    }
    offsetBadgeTimeout = setTimeout(() => {
      hideOffsetBadge();
    }, 3000);
  }
};

const TTSController = () => {
  try {
    let controllerElement = null;
    let isDragging = false;
    let isOffsetReady = false;
    let isOffsetActive = false;
    let isDragReady = false;
    let startX, startY, initialLeft, initialTop;
    let offsetTimer = null;
    let dragTimer = null;
    let lastSwipeY = null;
    let stepsTaken = 0;

    // Restore saved position with validation
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

      if (
        leftVal < 0 ||
        leftVal > windowWidth - 20 ||
        topVal < 0 ||
        topVal > windowHeight - 20
      ) {
        savedLeft = null;
        savedTop = null;
      }
    }

    // --- Helpers ---
    const clearTimers = () => {
      if (offsetTimer) {
        clearTimeout(offsetTimer);
        offsetTimer = null;
      }
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
    };

    const startDrag = (ctX, ctY, dX, dY) => {
      clearTimers();
      isDragging = true;
      isOffsetReady = false;
      isOffsetActive = false;
      isDragReady = false;
      controllerElement.dataset.dragging = 'true';
      controllerElement.classList.remove('offset-mode', 'drag-ready');
      hideOffsetBadge();

      const bw = controllerElement.offsetWidth;
      const bh = controllerElement.offsetHeight;

      dragElement(ctX, ctY, dX, dY, bw, bh);
    };

    const dragElement = (_, __, dX, dY, bw, bh) => {
      const nl = Math.max(
        0,
        Math.min(initialLeft + dX, window.innerWidth - bw),
      );
      const nt = Math.max(
        0,
        Math.min(initialTop + dY, window.innerHeight - bh),
      );
      controllerElement.style.transform = `translate(${nl}px, ${nt}px)`;
      controllerElement.style.left = '0px';
      controllerElement.style.top = '0px';
    };

    const enterOffsetReady = () => {
      isOffsetReady = true;
      controllerElement.classList.add('offset-mode');
      const initialOffset = initialReaderConfig.paragraphHighlightOffset || 0;
      showOffsetBadge(initialOffset);

      // Haptic feedback if enabled
      if (navigator.vibrate && !initialReaderConfig.disableHapticFeedback) {
        navigator.vibrate(15);
      }

      // Show discoverability hint on first use and toggle off
      if (initialReaderConfig.ttsShowGestureHints) {
        reader.post({
          type: 'show-toast',
          data: 'Swipe up/down to adjust highlight offset',
        });
        reader.post({
          type: 'tts-apply-settings',
          data: { ttsShowGestureHints: false },
        });
        initialReaderConfig.ttsShowGestureHints = false;
      }

      // Start drag timer: 1500ms after offset ready = 2000ms total
      dragTimer = setTimeout(() => {
        if (isOffsetReady && !isOffsetActive) {
          isOffsetReady = false;
          isDragReady = true;
          controllerElement.classList.remove('offset-mode');
          controllerElement.classList.add('drag-ready');
          hideOffsetBadge();
          if (navigator.vibrate && !initialReaderConfig.disableHapticFeedback) {
            navigator.vibrate(15);
          }
        }
      }, 1500);
    };

    const activateOffset = () => {
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
      isOffsetReady = false;
      isOffsetActive = true;
      stepsTaken = 0; // Reset step counter
      // No vibration here - only vibrate on successful adjustment
    };

    const cleanState = () => {
      clearTimers();
      if (controllerElement) {
        delete controllerElement.dataset.cleanupInProgress;
        delete controllerElement.dataset.dragging;
        controllerElement.classList.remove('offset-mode', 'drag-ready');
      }
      window.ttsOperationActive = false;
      window.ttsOperationEndTime = Date.now();
      isDragging = false;
      isOffsetReady = false;
      isOffsetActive = false;
      isDragReady = false;
      startX = undefined;
      startY = undefined;
      lastSwipeY = null;
      stepsTaken = 0; // Reset step counter
    };

    // --- Component ---
    return div(
      {
        id: 'TTS-Controller',
        class: () => (reader.generalSettings.val.TTSEnable ? '' : 'hidden'),
        style: () => {
          if (
            controllerElement &&
            (controllerElement.dataset.dragging === 'true' ||
              controllerElement.dataset.cleanupInProgress === 'true')
          ) {
            return 'transform: none;';
          }
          if (savedLeft && savedTop) {
            return `left: ${savedLeft}; top: ${savedTop};`;
          }
          return 'left: 15px; top: calc(50% - 25px);';
        },
        ontouchstart: e => {
          if (!controllerElement) {
            controllerElement = document.getElementById('TTS-Controller');
          }

          if (e.target.closest('#TTS-Controller')) {
            window.ttsOperationActive = true;

            isDragging = false;
            isOffsetReady = false;
            isOffsetActive = false;
            isDragReady = false;
            stepsTaken = 0; // Reset step counter
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastSwipeY = null;

            const rect = controllerElement.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            controllerElement.classList.add('active');
            controllerElement.style.transition = 'none';

            clearTimers();
            offsetTimer = setTimeout(enterOffsetReady, 500);

            e.stopPropagation();
          }
        },
        ontouchmove: e => {
          if (startX === undefined) return;

          const ctX = e.touches[0].clientX;
          const ctY = e.touches[0].clientY;
          const dX = ctX - startX;
          const dY = ctY - startY;
          const aX = Math.abs(dX);
          const aY = Math.abs(dY);

          // --- OFFSET ACTIVE: handle vertical swipe steps ---
          if (isOffsetActive) {
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();

            if (lastSwipeY === null) {
              lastSwipeY = ctY;
              return;
            }

            const swipeDelta = lastSwipeY - ctY;

            if (Math.abs(swipeDelta) >= 40) {
              // Limit to ±1 per gesture (max one step)
              if (stepsTaken === 0) {
                // Invert the sign: swipe up (positive delta) → offset -1 (highlight moves up)
                // swipe down (negative delta) → offset +1 (highlight moves down)
                const steps = -Math.sign(swipeDelta);
                reader.post({
                  type: 'adjust-highlight-offset',
                  data: { delta: steps },
                });
                stepsTaken = 1; // Mark as taken
                lastSwipeY = ctY;

                // Haptic feedback only on successful adjustment
                if (
                  navigator.vibrate &&
                  !initialReaderConfig.disableHapticFeedback
                ) {
                  navigator.vibrate(10);
                }
              }
            }
            return;
          }

          // --- OFFSET READY: vertical swipe → offset, other → drag ---
          if (isOffsetReady) {
            // Primarily vertical with enough distance → activate offset
            if (aY > 15 && aY >= aX) {
              activateOffset();
              lastSwipeY = ctY;
              if (e.cancelable) {
                e.preventDefault();
              }
              e.stopPropagation();
              return;
            }

            // Primarily horizontal movement → start drag
            if (aX > 15 && aX > aY) {
              startDrag(ctX, ctY, dX, dY);
              if (e.cancelable) {
                e.preventDefault();
              }
              e.stopPropagation();
              return;
            }

            // Small movement while offset ready → wait (allows vertical accumulation)
            e.stopPropagation();
            return;
          }

          // --- DRAG READY: any movement → drag ---
          if (isDragReady) {
            if (aX > 5 || aY > 5) {
              startDrag(ctX, ctY, dX, dY);
              if (e.cancelable) {
                e.preventDefault();
              }
              e.stopPropagation();
              return;
            }

            e.stopPropagation();
            return;
          }

          // --- NOT READY YET: movement > 30px → immediate drag (tolerates finger drift) ---
          if (aX > 30 || aY > 30) {
            startDrag(ctX, ctY, dX, dY);
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();
          }
        },
        ontouchend: e => {
          clearTimers();

          if (isDragging) {
            hideOffsetBadge();
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();

            controllerElement.dataset.cleanupInProgress = 'true';

            const rect = controllerElement.getBoundingClientRect();
            const finalLeft = rect.left;
            const finalTop = rect.top;

            savedLeft = finalLeft + 'px';
            savedTop = finalTop + 'px';

            SafeStorage.setItem('tts-controller-left', savedLeft);
            SafeStorage.setItem('tts-controller-top', savedTop);

            reader.post({
              type: 'save-tts-position',
              data: { left: savedLeft, top: savedTop },
            });

            controllerElement.classList.remove('active');
            controllerElement.style.transform = 'none';
            controllerElement.style.left = savedLeft;
            controllerElement.style.top = savedTop;
            controllerElement.style.transition = '0.5s';

            setTimeout(() => {
              if (controllerElement) {
                delete controllerElement.dataset.cleanupInProgress;
                delete controllerElement.dataset.dragging;
              }
              window.ttsOperationActive = false;
              window.ttsOperationEndTime = Date.now();
              isDragging = false;
              startX = undefined;
              startY = undefined;
              lastSwipeY = null;
            }, 300);
            return;
          }

          // Active offset mode → suppress click
          if (isOffsetActive) {
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();

            controllerElement.classList.remove('offset-mode', 'active');
            controllerElement.style.transition = '0.5s';

            if (offsetBadgeTimeout) {
              clearTimeout(offsetBadgeTimeout);
            }
            offsetBadgeTimeout = setTimeout(hideOffsetBadge, 3000);

            cleanState();
            return;
          }

          // Drag ready → suppress click (held 2s without moving)
          if (isDragReady) {
            if (e.cancelable) {
              e.preventDefault();
            }
            e.stopPropagation();

            controllerElement.classList.remove('drag-ready', 'active');
            controllerElement.style.transition = '0.5s';

            cleanState();
            return;
          }

          // Offset ready → allow click (held 500ms, no swipe)
          if (isOffsetReady) {
            isOffsetReady = false;
            if (e.cancelable) {
              e.preventDefault();
            }
            controllerElement.classList.remove('offset-mode', 'active');
            controllerElement.style.transition = '0.5s';
            hideOffsetBadge();
            cleanState();
            e.stopPropagation();
            return;
          }

          // Normal tap → allow click
          window.ttsOperationActive = false;

          if (controllerElement) {
            if (controllerElement.dataset.dragging !== 'true') {
              controllerElement.classList.remove('active');
            }
            controllerElement.style.transition = '0.5s';
          }

          cleanState();
        },
        ontouchcancel: e => {
          cleanState();
          if (controllerElement) {
            controllerElement.classList.remove(
              'active',
              'offset-mode',
              'drag-ready',
            );
            controllerElement.style.transition = '0.5s';
          }
          hideOffsetBadge();
        },
        onclick: e => {
          e.stopPropagation();
          window.ttsOperationActive = true;

          if (isDragging || isOffsetActive || isDragReady) {
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
