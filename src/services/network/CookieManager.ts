/**
 * Cookie Manager Service
 *
 * Wraps @react-native-cookies/cookies to provide automatic cookie persistence
 * and management following yokai's proven architecture.
 *
 * Key Features:
 * - Automatic cookie persistence across app restarts
 * - Android CookieManager integration (same as WebView)
 * - Three-tier cookie clearing: global, per-URL, WebView
 * - Automatic sync between HTTP requests and WebView
 */

import CookieManagerLib from '@react-native-cookies/cookies';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const log = createRateLimitedLogger('CookieManager');

export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
}

/**
 * Cookie Manager Service
 *
 * Provides cookie persistence and management functionality.
 */
export class CookieManager {
  /**
   * Get all cookies for a given URL
   *
   * @param url - The URL to get cookies for
   * @returns Promise resolving to cookie name-value pairs
   *
   * @example
   * const cookies = await CookieManager.getCookies('https://example.com');
   * // Returns: { session_id: 'abc123', user_id: 'xyz789' }
   */
  static async getCookies(url: string): Promise<Record<string, string>> {
    try {
      const cookiesObject = await CookieManagerLib.get(url);

      // Convert from CookieManager format to simple key-value pairs
      const result: Record<string, string> = {};

      if (cookiesObject && typeof cookiesObject === 'object') {
        Object.entries(cookiesObject).forEach(([name, cookieData]) => {
          if (
            cookieData &&
            typeof cookieData === 'object' &&
            'value' in cookieData
          ) {
            result[name] = String(cookieData.value);
          }
        });
      }

      log.info(
        'get-cookies',
        `Retrieved ${Object.keys(result).length} cookie(s) for ${url}`,
      );
      return result;
    } catch (error) {
      log.error(
        'get-cookies-failed',
        `Failed to get cookies for ${url}:`,
        error,
      );
      return {};
    }
  }

  /**
   * Set cookies for a given URL
   *
   * @param url - The URL to set cookies for
   * @param cookies - Cookie name-value pairs to set
   * @returns Promise that resolves when cookies are set
   *
   * @example
   * await CookieManager.setCookies('https://example.com', {
   *   session_id: 'abc123',
   *   user_id: 'xyz789'
   * });
   */
  static async setCookies(
    url: string,
    cookies: Record<string, string>,
  ): Promise<void> {
    try {
      const cookiePromises = Object.entries(cookies).map(([name, value]) => {
        const cookieData: CookieData = {
          name,
          value,
          domain: new URL(url).hostname,
          path: '/',
        };

        return CookieManagerLib.set(url, cookieData);
      });

      await Promise.all(cookiePromises);

      log.info(
        'set-cookies',
        `Set ${Object.keys(cookies).length} cookie(s) for ${url}`,
      );
    } catch (error) {
      log.error(
        'set-cookies-failed',
        `Failed to set cookies for ${url}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clear cookies for a specific URL
   *
   * @param url - The URL to clear cookies for
   * @returns Promise resolving to the number of cookies cleared
   *
   * @example
   * const count = await CookieManager.clearCookies('https://example.com');
   * // Returns: 3 (cleared 3 cookies)
   */
  static async clearCookies(url: string): Promise<number> {
    try {
      // Get existing cookies first to count them
      const existingCookies = await this.getCookies(url);
      const cookieCount = Object.keys(existingCookies).length;

      if (cookieCount === 0) {
        log.info('clear-cookies', `No cookies to clear for ${url}`);
        return 0;
      }

      // Clear each cookie by setting it with an expired date
      const clearPromises = Object.keys(existingCookies).map(name => {
        const cookieData: CookieData = {
          name,
          value: '',
          domain: new URL(url).hostname,
          path: '/',
          expires: new Date(0).toISOString(), // Expire in the past
        };

        return CookieManagerLib.set(url, cookieData);
      });

      await Promise.all(clearPromises);

      log.info('clear-cookies', `Cleared ${cookieCount} cookie(s) for ${url}`);
      return cookieCount;
    } catch (error) {
      log.error(
        'clear-cookies-failed',
        `Failed to clear cookies for ${url}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clear all cookies globally
   *
   * @returns Promise that resolves when all cookies are cleared
   *
   * @example
   * await CookieManager.clearAllCookies();
   */
  static async clearAllCookies(): Promise<void> {
    try {
      await CookieManagerLib.clearAll();
      await CookieManagerLib.flush(); // Persist changes immediately (Android only)

      log.info('clear-all-cookies', 'Cleared all cookies globally');
    } catch (error) {
      log.error(
        'clear-all-cookies-failed',
        'Failed to clear all cookies:',
        error,
      );
      throw error;
    }
  }
}

/**
 * Named export for convenience
 */
export default CookieManager;
