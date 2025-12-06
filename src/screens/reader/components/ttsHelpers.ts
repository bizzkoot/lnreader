import type { RefObject } from 'react';

import logger from '../../../utils/devLogger';

export function applyTtsUpdateToWebView(settings: any, webViewRef: RefObject<any>) {
  try {
    if (webViewRef && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function(){
          if (window.tts && typeof window.tts.applySettings === 'function') {
            window.tts.applySettings(${JSON.stringify(settings)});
          }
        })();
      `);
      return true;
    }
    return false;
  } catch (e) {
    logger.error('applyTtsUpdateToWebView failed', e);
    return false;
  }
}
