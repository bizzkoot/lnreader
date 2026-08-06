import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Slider, { shouldClaimPanResponder } from '../Slider/Slider';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

const responderEvent = (locationX: number) => ({
  nativeEvent: { locationX },
  touchHistory: {
    indexOfSingleActiveTouch: -1,
    mostRecentTimeStamp: 0,
    numberActiveTouches: 0,
    touchBank: [],
  },
});

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

  // The slider's PanResponder never claims a touch at start
  // (onStartShouldSetPanResponder => false), which makes RNTL treat it as
  // non-interactive (fireEvent silently no-ops). We therefore drive the
  // responder/layout/a11y handlers directly — they are the same props fireEvent
  // would dispatch to.
  const grant = (slider: ReturnType<typeof screen.getByTestId>, x: number) => {
    act(() => {
      slider.props.onResponderGrant(responderEvent(x));
    });
  };

  const release = (
    slider: ReturnType<typeof screen.getByTestId>,
    x: number,
  ) => {
    act(() => {
      slider.props.onResponderRelease(responderEvent(x));
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
    layoutSlider();

    fireEvent(screen.getByTestId('slider-press-surface'), 'click', {
      nativeEvent: { locationX: 142 },
    });

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
    layoutSlider();

    fireEvent(screen.getByTestId('slider-press-surface'), 'click', {
      nativeEvent: { locationX: 142 },
    });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onSlidingComplete).not.toHaveBeenCalled();
  });

  it('does not claim responder at touch start, so vertical swipes reach the parent ScrollView', () => {
    render(<Slider value={5} min={0} max={10} />);
    const slider = screen.getByTestId('slider');

    const startShouldSet = slider.props.onStartShouldSetResponder as
      | ((event?: object) => boolean)
      | undefined;
    expect(startShouldSet).toBeDefined();
    expect(
      startShouldSet!({
        nativeEvent: {},
        touchHistory: {
          indexOfSingleActiveTouch: -1,
          mostRecentTimeStamp: 0,
          numberActiveTouches: 1,
          touchBank: [],
        },
      }),
    ).toBe(false);
  });

  it('claims only horizontal-dominant drags through the responder system', () => {
    render(<Slider value={5} min={0} max={10} />);
    const slider = screen.getByTestId('slider');

    const moveCapture = slider.props.onMoveShouldSetResponderCapture as
      | ((event?: object) => boolean)
      | undefined;
    const moveShouldSet = slider.props.onMoveShouldSetResponder as
      | ((event?: object) => boolean)
      | undefined;
    expect(moveCapture).toBeDefined();
    expect(moveShouldSet).toBeDefined();

    // Build touchHistory entries whose current-vs-previous delta is the
    // gesture movement between two events. PanResponder accumulates dx/dy
    // across moves (capture phase), then the bubbling handler consults our
    // predicate with the accumulated values.
    const moveEvent = (
      curX: number,
      curY: number,
      prevX: number,
      prevY: number,
      ts: number,
    ) => ({
      nativeEvent: { touches: [{ identifier: 0 }] },
      touchHistory: {
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: ts,
        touchBank: [
          {
            touchActive: true,
            startPageX: 100,
            startPageY: 100,
            startTimeStamp: 0,
            currentPageX: curX,
            currentPageY: curY,
            currentTimeStamp: ts,
            previousPageX: prevX,
            previousPageY: prevY,
            previousTimeStamp: ts - 1,
          },
        ],
      },
    });

    // Horizontal move: delta (25, 0) => accumulated (25, 0) => claimed.
    moveCapture!(moveEvent(125, 100, 100, 100, 100));
    expect(moveShouldSet!(moveEvent(125, 100, 100, 100, 100))).toBe(true);

    // Mostly-vertical move: delta (-23, 25) => accumulated (2, 25) => not
    // claimed, so the parent ScrollView can scroll.
    moveCapture!(moveEvent(102, 125, 125, 100, 200));
    expect(moveShouldSet!(moveEvent(102, 125, 125, 100, 200))).toBe(false);
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
