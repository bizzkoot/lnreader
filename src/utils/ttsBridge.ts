interface TTSSettings {
  [key: string]: unknown;
}

interface WebViewWindow extends Window {
  ReactNativeWebView?: {
    postMessage: (message: string) => void;
  };
  __LNREADER_NONCE__?: string;
}

export function postTtsSettingsToWebView(settings: TTSSettings): boolean {
  try {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as WebViewWindow).ReactNativeWebView &&
      (window as unknown as WebViewWindow).ReactNativeWebView?.postMessage
    ) {
      const webViewWindow = window as unknown as WebViewWindow;
      const nonce = webViewWindow.__LNREADER_NONCE__;
      webViewWindow.ReactNativeWebView?.postMessage(
        JSON.stringify({
          type: 'tts-update-settings',
          data: settings,
          nonce: typeof nonce === 'string' ? nonce : undefined,
        }),
      );
      return true;
    }
    // Not available - nothing to do
    return false;
  } catch (_e) {
    return false;
  }
}
