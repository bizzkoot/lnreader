import { postTtsSettingsToWebView } from '../ttsBridge';

describe('ttsBridge', () => {
  beforeEach(() => {
    // Reset the global
    (global as any).window = {} as any;
  });

  it('should call window.ReactNativeWebView.postMessage when available', () => {
    const postMessage = jest.fn();
    (global as any).window.ReactNativeWebView = { postMessage };

    const result = postTtsSettingsToWebView({ voice: 'en-US' });
    expect(result).toBe(true);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const arg = postMessage.mock.calls[0][0];
    expect(typeof arg).toBe('string');
    expect(arg).toContain('tts-update-settings');
    expect(arg).toContain('en-US');
  });

  it('should return false and not throw if webview is not available', () => {
    (global as any).window = {} as any;
    const result = postTtsSettingsToWebView({ rate: 1.2 });
    expect(result).toBe(false);
  });
});
