export function postTtsSettingsToWebView(settings: any) {
  try {
    if (
      typeof window !== 'undefined' &&
      (window as any).ReactNativeWebView &&
      (window as any).ReactNativeWebView.postMessage
    ) {
      const nonce = (window as any).__LNREADER_NONCE__;
      (window as any).ReactNativeWebView.postMessage(
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
  } catch (e) {
    return false;
  }
}
