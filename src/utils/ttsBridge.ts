export function postTtsSettingsToWebView(settings: any) {
  try {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView && (window as any).ReactNativeWebView.postMessage) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'tts-update-settings', data: settings })
      );
      return true;
    }
    // Not available - nothing to do
    // eslint-disable-next-line no-console
    console.warn('Reader/webview not available for TTS settings update');
    return false;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to send TTS settings to Reader/webview:', e);
    return false;
  }
}
