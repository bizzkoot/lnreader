import { applyTtsUpdateToWebView } from '../ttsHelpers';

describe('applyTtsUpdateToWebView', () => {
  it('should inject JS in webview when webViewRef provided', () => {
    const injectJavaScript = jest.fn();
    const webViewRef = { current: { injectJavaScript } } as any;

    const result = applyTtsUpdateToWebView({ voice: 'EN' }, webViewRef);

    expect(result).toBe(true);
    expect(injectJavaScript).toHaveBeenCalledTimes(1);
    const jsArg = injectJavaScript.mock.calls[0][0];
    expect(jsArg).toContain('window.tts');
    expect(jsArg).toContain('EN');
  });

  it('should return false if webViewRef is empty', () => {
    const webViewRef = { current: null } as any;
    const result = applyTtsUpdateToWebView({ voice: 'EN' }, webViewRef);
    expect(result).toBe(false);
  });
});
