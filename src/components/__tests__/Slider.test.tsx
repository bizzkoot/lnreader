import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import Slider, { shouldClaimPanResponder } from '../Slider/Slider';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

let testTimestamp = 100;

const responderEvent = (
  locationX: number,
  pageX: number = locationX,
  startX: number = locationX,
) => {
  testTimestamp += 16;
  return {
    nativeEvent: { locationX, pageX, touches: [{ identifier: 0 }] },
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: testTimestamp,
      numberActiveTouches: 1,
      touchBank: [
        {
          touchActive: true,
          startPageX: startX,
          startPageY: 100,
          startTimeStamp: 0,
          currentPageX: pageX,
          currentPageY: 100,
          currentTimeStamp: testTimestamp,
          previousPageX: pageX,
          previousPageY: 100,
          previousTimeStamp: testTimestamp - 16,
        },
      ],
    },
  };
};

const accessibilityActionEvent = (actionName: string) => ({
  nativeEvent: { actionName },
});

describe('Slider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      primary: '#6750a4',
      onPrimary: '#ffffff',
      secondaryContainer: '#e8def8',
      onSecondaryContainer: '#1d192b',
      onSurface: '#1d1b20',
      inverseSurface: '#322f35',
      inverseOnSurface: '#f5eff7',
      rippleColor: 'rgba(103, 80, 164, 0.12)',
    });
  });

  const layoutSlider = () => {
    const slider = screen.getByTestId('slider');
    act(() => {
      slider.props.onLayout({
        nativeEvent: {
          layout: { width: 200, height: 48, x: 0, y: 0 },
        },
      });
    });
    return slider;
  };

  // We drive the responder/layout/a11y handlers directly to simulate touch interactions.
  const grant = (
    slider: ReturnType<typeof screen.getByTestId>,
    x: number,
    pageX?: number,
    startX?: number,
  ) => {
    act(() => {
      slider.props.onResponderGrant(responderEvent(x, pageX, startX));
    });
  };

  const move = (
    slider: ReturnType<typeof screen.getByTestId>,
    x: number,
    pageX?: number,
    startX?: number,
  ) => {
    act(() => {
      slider.props.onResponderMove(responderEvent(x, pageX, startX));
    });
  };

  const release = (
    slider: ReturnType<typeof screen.getByTestId>,
    x: number,
    pageX?: number,
    startX?: number,
  ) => {
    act(() => {
      slider.props.onResponderRelease(responderEvent(x, pageX, startX));
    });
  };

  const accessibilityAction = (
    slider: ReturnType<typeof screen.getByTestId>,
    actionName: string,
  ) => {
    act(() => {
      slider.props.onAccessibilityAction(accessibilityActionEvent(actionName));
    });
  };

  it('exposes the current range to accessibility services', () => {
    render(
      <Slider value={4} min={0} max={10} accessibilityLabel="Reading size" />,
    );

    expect(screen.getByLabelText('Reading size')).toHaveAccessibilityValue({
      min: 0,
      max: 10,
      now: 4,
      text: '4',
    });
  });

  it('maps touch position to a stepped value', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={2}
        onValueChange={onValueChange}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 142);

    expect(onValueChange).toHaveBeenLastCalledWith(8);
  });

  it('updates value and handle position live during dragging gestures', () => {
    const onValueChange = jest.fn();
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={1}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();

    // Touch down at x=20
    grant(slider, 20);
    expect(onValueChange).toHaveBeenLastCalledWith(1);

    // Drag forward to x=100
    move(slider, 100);
    expect(onValueChange).toHaveBeenLastCalledWith(5);

    // Drag further to x=180
    move(slider, 180);
    expect(onValueChange).toHaveBeenLastCalledWith(9);

    // Release at current position
    release(slider, 180);
    expect(onSlidingComplete).toHaveBeenCalledWith(9);
  });

  it('uses the MD3 XS track, gap, and handle measurements by default', () => {
    render(<Slider value={5} min={0} max={10} />);
    layoutSlider();

    expect(screen.getByTestId('slider')).toHaveStyle({ height: 48 });
    expect(screen.getByTestId('slider-handle')).toHaveStyle({
      borderRadius: 2,
      height: 44,
      top: 2,
      width: 4,
    });
    expect(screen.getByTestId('slider-active-track')).toHaveStyle({
      borderTopLeftRadius: 8,
      borderTopRightRadius: 2,
      height: 16,
      top: 16,
      width: 92,
    });
    expect(screen.getByTestId('slider-inactive-track')).toHaveStyle({
      borderTopLeftRadius: 2,
      borderTopRightRadius: 8,
      height: 16,
      top: 16,
      width: 92,
    });
  });

  it('supports accessibility increment and decrement actions', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        value={4}
        min={0}
        max={10}
        step={2}
        onValueChange={onValueChange}
      />,
    );
    const slider = screen.getByTestId('slider');

    accessibilityAction(slider, 'increment');
    accessibilityAction(slider, 'decrement');

    expect(onValueChange).toHaveBeenNthCalledWith(1, 6);
    expect(onValueChange).toHaveBeenNthCalledWith(2, 2);
  });

  it('reports the final value when sliding completes', () => {
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 100);
    release(slider, 100);

    expect(onSlidingComplete).toHaveBeenCalledWith(5);
  });

  it('keeps the released value visible until the controlled value updates', () => {
    const onSlidingComplete = jest.fn();
    const { rerender } = render(
      <Slider
        value={5}
        min={1}
        max={5}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 2);
    release(slider, 2);

    expect(onSlidingComplete).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('slider-handle')).toHaveStyle({ left: 2 });

    rerender(
      <Slider
        value={1}
        min={1}
        max={5}
        step={1}
        onSlidingComplete={onSlidingComplete}
      />,
    );

    expect(screen.getByTestId('slider-handle')).toHaveStyle({ left: 2 });
  });

  it('does not respond while disabled', () => {
    const onValueChange = jest.fn();
    render(
      <Slider
        disabled
        value={4}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 150);
    accessibilityAction(slider, 'increment');

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('jumps the handle on track tap and reports completion', () => {
    const onValueChange = jest.fn();
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        value={0}
        min={0}
        max={10}
        step={2}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 142);
    release(slider, 142);

    expect(onValueChange).toHaveBeenLastCalledWith(8);
    expect(onSlidingComplete).toHaveBeenCalledWith(8);
  });

  it('does not respond to taps while disabled', () => {
    const onValueChange = jest.fn();
    const onSlidingComplete = jest.fn();
    render(
      <Slider
        disabled
        value={0}
        min={0}
        max={10}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
      />,
    );
    const slider = layoutSlider();

    grant(slider, 142);
    release(slider, 142);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onSlidingComplete).not.toHaveBeenCalled();
  });

  it('claims responder at touch start while enabled to prevent pager interception', () => {
    const { rerender } = render(<Slider value={5} min={0} max={10} />);
    const slider = screen.getByTestId('slider');

    const startShouldSet = slider.props.onStartShouldSetResponder as
      | ((event?: object) => boolean)
      | undefined;
    expect(startShouldSet).toBeDefined();
    expect(startShouldSet!()).toBe(true);

    rerender(<Slider disabled value={5} min={0} max={10} />);
    expect(slider.props.onStartShouldSetResponder!()).toBe(false);
  });
});

describe('shouldClaimPanResponder', () => {
  it('does not claim vertical gestures (parent ScrollView scrolls)', () => {
    expect(shouldClaimPanResponder(0, 20)).toBe(false);
    expect(shouldClaimPanResponder(-3, 30)).toBe(false);
  });

  it('claims horizontal-dominant drags once past the threshold', () => {
    expect(shouldClaimPanResponder(20, 0)).toBe(true);
    expect(shouldClaimPanResponder(-18, 4)).toBe(true);
  });

  it('ignores taps and small jitter below the threshold', () => {
    expect(shouldClaimPanResponder(0, 0)).toBe(false);
    expect(shouldClaimPanResponder(5, 0)).toBe(false);
  });

  it('does not claim diagonal gestures that are not clearly horizontal', () => {
    expect(shouldClaimPanResponder(20, 25)).toBe(false);
    expect(shouldClaimPanResponder(20, 20)).toBe(false);
  });

  it('never claims while disabled', () => {
    expect(shouldClaimPanResponder(20, 0, true)).toBe(false);
    expect(shouldClaimPanResponder(0, 0, true)).toBe(false);
  });
});
