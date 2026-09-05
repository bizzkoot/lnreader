// Tracks whether any Slider instance is actively dragging so parents
// (e.g. ReaderBottomSheet TabView ViewPager) can disable competing
// horizontal gestures while a slider thumb is being dragged.
// AUD-GEST-02 fix: prevents native ViewPager from stealing a fast
// horizontal slider drag and causing a half-committed value + tab jump.
const listeners = new Set<(dragging: boolean) => void>();
let dragging = false;

export const setSliderDragging = (value: boolean): void => {
  if (dragging === value) return;
  dragging = value;
  listeners.forEach(listener => {
    try {
      listener(value);
    } catch {
      // best-effort
    }
  });
};

export const subscribeSliderDragging = (
  listener: (dragging: boolean) => void,
): (() => void) => {
  listeners.add(listener);
  // Sync initial state immediately
  try {
    listener(dragging);
  } catch {
    // ignore
  }
  return () => {
    listeners.delete(listener);
  };
};

export const isSliderDragging = (): boolean => dragging;
