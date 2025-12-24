import type { RefObject } from 'react';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const ttsHelpersLog = createRateLimitedLogger('ttsHelpers', { windowMs: 1500 });

export function applyTtsUpdateToWebView(
  settings: any,
  webViewRef: RefObject<any>,
) {
  try {
    if (webViewRef && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function(){
          if (window.tts && typeof window.tts.applySettings === 'function') {
            window.tts.applySettings(${JSON.stringify(settings)});
          }
        })();
        true;
      `);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * FIX Case 9.2: Safe WebView JavaScript injection wrapper
 * Wraps injectJavaScript calls in try-catch to prevent silent failures
 * when WebView is in a bad state or has crashed.
 *
 * @param webViewRef - Reference to the WebView component
 * @param script - JavaScript code to inject
 * @param context - Optional context string for error logging
 * @returns true if injection succeeded, false otherwise
 */
export function safeInjectJS(
  webViewRef: RefObject<any>,
  script: string,
  context?: string,
): boolean {
  try {
    if (!webViewRef?.current) {
      return false;
    }

    const suffix = script.trimEnd().endsWith('true;') ? '' : '\ntrue;';
    webViewRef.current.injectJavaScript(`${script}${suffix}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * FIX Case 1.1: Validate and clamp paragraph index to valid range
 * Ensures paragraph index doesn't exceed available paragraphs count.
 * Logs a warning when the saved index exceeds available paragraphs.
 *
 * @param paragraphIndex - The paragraph index to validate
 * @param totalParagraphs - Total number of paragraphs available
 * @param context - Optional context string for logging
 * @returns Clamped paragraph index within valid range [0, totalParagraphs - 1]
 */
export function validateAndClampParagraphIndex(
  paragraphIndex: number,
  totalParagraphs: number,
  context?: string,
): number {
  // Handle edge cases
  if (totalParagraphs <= 0) {
    ttsHelpersLog.warn(
      'no-paragraphs',
      `No paragraphs available${context ? ` (${context})` : ''}`,
    );
    return 0;
  }

  // Invalid negative index - start from beginning
  if (paragraphIndex < 0) {
    return 0;
  }

  // Check if index exceeds available paragraphs
  const maxValidIndex = totalParagraphs - 1;
  if (paragraphIndex > maxValidIndex) {
    ttsHelpersLog.warn(
      'index-exceeds-max',
      `Index ${paragraphIndex} exceeds available paragraphs (max: ${maxValidIndex})${context ? ` - ${context}` : ''}. Clamping to ${maxValidIndex}.`,
    );
    return maxValidIndex;
  }

  return paragraphIndex;
}
