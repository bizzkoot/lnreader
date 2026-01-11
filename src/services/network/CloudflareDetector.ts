/**
 * Cloudflare Challenge Detector
 *
 * Detects Cloudflare protection challenges in HTTP responses.
 * Used by CloudflareBypass service to determine when bypass is needed.
 *
 * Detection Methods:
 * 1. Status code (403/503) + Server header
 * 2. Presence of cf_clearance cookie (bypass status)
 *
 * Reference: specs/network-cookie-handling/10-CLOUDFLARE-BYPASS-RESEARCH.md
 */

import { CookieManager } from './CookieManager';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const log = createRateLimitedLogger('CloudflareDetector');

/**
 * Cloudflare Challenge Detector
 */
export class CloudflareDetector {
  /**
   * Status codes that indicate potential Cloudflare challenge
   */
  private static readonly CLOUDFLARE_STATUS_CODES = [403, 503];

  /**
   * Server header values that confirm Cloudflare protection
   */
  private static readonly CLOUDFLARE_SERVER_HEADERS = [
    'cloudflare',
    'cloudflare-nginx',
  ];

  /**
   * Cloudflare bypass cookie name (set after challenge solved)
   */
  private static readonly CF_CLEARANCE_COOKIE = 'cf_clearance';

  /**
   * Cloudflare bot management cookie name
   */
  private static readonly CF_BM_COOKIE = '__cf_bm';

  /**
   * Body content signatures for Cloudflare challenges
   * Used as fallback detection method
   */
  private static readonly BODY_SIGNATURES = [
    'cf-browser-verification',
    'cf_chl_opt',
    'challenge-platform',
    'Checking your browser',
    'Just a moment...',
    'Please wait while we verify your browser',
  ];

  /**
   * Check if a response indicates a Cloudflare challenge
   *
   * Primary detection: Status code + Server header
   *
   * @param response - The HTTP response to check
   * @returns True if response is a Cloudflare challenge
   *
   * @example
   * const response = await fetch(url);
   * if (CloudflareDetector.isChallenge(response)) {
   *   // Trigger bypass
   * }
   */
  static isChallenge(response: Response): boolean {
    // Check status code first (fast check)
    if (!this.CLOUDFLARE_STATUS_CODES.includes(response.status)) {
      return false;
    }

    // Confirm via Server header
    const server = response.headers.get('Server')?.toLowerCase() || '';
    const isCloudflare = this.CLOUDFLARE_SERVER_HEADERS.some(cf =>
      server.includes(cf),
    );

    if (isCloudflare) {
      log.info(
        `isChallenge`,
        `Cloudflare challenge detected: ${response.status} from ${server}`,
      );
    }

    return isCloudflare;
  }

  /**
   * Check if a response might be a Cloudflare challenge based on body content
   * (Fallback method when headers are not conclusive)
   *
   * @param body - Response body text
   * @returns True if body contains Cloudflare challenge signatures
   */
  static isChallengePage(body: string): boolean {
    return this.BODY_SIGNATURES.some(signature => body.includes(signature));
  }

  /**
   * Check if we have a valid cf_clearance cookie for a URL
   * Indicates that bypass is not needed or has already succeeded
   *
   * @param url - The URL to check for bypass cookie
   * @returns Promise resolving to true if cf_clearance cookie exists
   *
   * @example
   * const hasBypass = await CloudflareDetector.hasBypassCookie(url);
   * if (!hasBypass) {
   *   await CloudflareBypass.solve(url);
   * }
   */
  static async hasBypassCookie(url: string): Promise<boolean> {
    try {
      const cookies = await CookieManager.getCookies(url);
      const hasClearing = this.CF_CLEARANCE_COOKIE in cookies;
      const hasBm = this.CF_BM_COOKIE in cookies;

      if (hasClearing || hasBm) {
        log.info(
          `hasBypassCookie`,
          `Bypass cookie found for ${url}: cf_clearance=${hasClearing}, __cf_bm=${hasBm}`,
        );
        return true;
      }

      return false;
    } catch (error) {
      log.error(`hasBypassCookie`, `Error checking bypass cookie: ${error}`);
      return false;
    }
  }

  /**
   * Clear Cloudflare bypass cookies for a URL
   * Forces re-bypass on next request
   *
   * @param url - The URL to clear bypass cookies for
   * @returns Promise resolving when cookies are cleared
   */
  static async clearBypassCookie(url: string): Promise<void> {
    try {
      // Clear specific Cloudflare cookies
      const cookies = await CookieManager.getCookies(url);
      const cfCookies = Object.keys(cookies).filter(
        name =>
          name === this.CF_CLEARANCE_COOKIE ||
          name === this.CF_BM_COOKIE ||
          name.startsWith('cf_') ||
          name.startsWith('__cf'),
      );

      if (cfCookies.length > 0) {
        log.info(
          `clearBypassCookie`,
          `Clearing ${cfCookies.length} Cloudflare cookie(s) for ${url}`,
        );
      }

      // Note: Currently we clear all cookies for the URL
      // A more granular approach would be to clear only CF cookies
      // but @react-native-cookies/cookies doesn't support per-cookie deletion
      await CookieManager.clearCookies(url);
    } catch (error) {
      log.error(`clearBypassCookie`, `Error clearing bypass cookie: ${error}`);
      throw error;
    }
  }

  /**
   * Extract Cloudflare Ray ID from response headers (for debugging)
   *
   * @param response - The HTTP response
   * @returns Cloudflare Ray ID if present, null otherwise
   */
  static getCloudflareRayId(response: Response): string | null {
    return response.headers.get('CF-RAY');
  }
}
