/**
 * Cloudflare Bypass Service
 *
 * Solves Cloudflare challenges using WebView-based approach.
 * Automatically handles JS challenges, falls back to manual mode for CAPTCHA.
 *
 * Architecture:
 * 1. Detection: CloudflareDetector identifies challenge
 * 2. Bypass: Load URL in WebView (hidden or modal)
 * 3. Wait: Monitor for cf_clearance cookie (up to 30s)
 * 4. Success: Extract cookies via CookieManager
 * 5. Retry: Original request auto-injects cookies
 *
 * Reference: specs/network-cookie-handling/10-CLOUDFLARE-BYPASS-RESEARCH.md
 */

import { CookieManager } from './CookieManager';
import { CloudflareDetector } from './CloudflareDetector';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const log = createRateLimitedLogger('CloudflareBypass');

/**
 * Result of a Cloudflare bypass attempt
 */
export interface CloudflareBypassResult {
  /**
   * Whether bypass succeeded (cf_clearance cookie obtained)
   */
  success: boolean;

  /**
   * Cookies obtained during bypass (if successful)
   */
  cookies?: Record<string, string>;

  /**
   * Error message if bypass failed
   */
  error?: string;

  /**
   * Time taken to solve challenge (milliseconds)
   */
  duration?: number;
}

/**
 * Options for Cloudflare bypass attempt
 */
export interface CloudflareBypassOptions {
  /**
   * URL to load in WebView for challenge solving
   */
  url: string;

  /**
   * Timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Whether to use hidden WebView (default: false)
   * If false, shows modal with "Verifying..." message
   */
  hidden?: boolean;

  /**
   * User-Agent to use in WebView (should match fetchApi UA)
   */
  userAgent?: string;

  /**
   * Callback when bypass state changes
   */
  onStateChange?: (state: CloudflareBypassState) => void;
}

/**
 * Bypass state for progress tracking
 */
export enum CloudflareBypassState {
  IDLE = 'idle',
  DETECTING = 'detecting',
  LOADING = 'loading',
  SOLVING = 'solving',
  SUCCESS = 'success',
  TIMEOUT = 'timeout',
  FAILED = 'failed',
}

/**
 * Global bypass state manager
 * Prevents multiple concurrent bypass attempts for the same URL
 */
class BypassStateManager {
  private activeAttempts = new Map<string, Promise<CloudflareBypassResult>>();

  /**
   * Get or create a bypass attempt for a URL
   * Ensures only one bypass per URL at a time
   */
  getOrCreate(
    url: string,
    factory: () => Promise<CloudflareBypassResult>,
  ): Promise<CloudflareBypassResult> {
    const existing = this.activeAttempts.get(url);
    if (existing) {
      log.info(`getOrCreate`, `Reusing existing bypass attempt for ${url}`);
      return existing;
    }

    const attempt = factory().finally(() => {
      this.activeAttempts.delete(url);
    });

    this.activeAttempts.set(url, attempt);
    return attempt;
  }

  /**
   * Check if bypass is in progress for a URL
   */
  isActive(url: string): boolean {
    return this.activeAttempts.has(url);
  }

  /**
   * Cancel all active bypass attempts
   */
  cancelAll(): void {
    this.activeAttempts.clear();
  }
}

const stateManager = new BypassStateManager();

/**
 * Cloudflare Bypass Service
 *
 * Main entry point for solving Cloudflare challenges.
 */
export class CloudflareBypass {
  /**
   * Default timeout for bypass attempts (30 seconds)
   */
  static readonly DEFAULT_TIMEOUT = 30000;

  /**
   * Cookie check interval (milliseconds)
   */
  static readonly COOKIE_CHECK_INTERVAL = 500;

  /**
   * Reference to active WebView bypass controller
   * Set by CloudflareWebView component when mounted
   */
  private static webViewController: CloudflareWebViewController | null = null;

  /**
   * Register WebView controller
   * Called by CloudflareWebView component
   */
  static registerWebViewController(
    controller: CloudflareWebViewController,
  ): void {
    this.webViewController = controller;
    log.info(`registerWebViewController`, `WebView controller registered`);
  }

  /**
   * Unregister WebView controller
   */
  static unregisterWebViewController(): void {
    this.webViewController = null;
    log.info(`unregisterWebViewController`, `WebView controller unregistered`);
  }

  /**
   * Solve Cloudflare challenge for a URL
   *
   * @param options - Bypass options
   * @returns Promise resolving to bypass result
   *
   * @example
   * const result = await CloudflareBypass.solve({
   *   url: 'https://example.com',
   *   timeout: 30000,
   *   hidden: true,
   * });
   *
   * if (result.success) {
   *   // Retry request - cookies auto-injected
   * }
   */
  static async solve(
    options: CloudflareBypassOptions,
  ): Promise<CloudflareBypassResult> {
    const { url } = options;

    log.info(`solve`, `Starting bypass for ${url}`);

    // Check if bypass already in progress
    return stateManager.getOrCreate(url, async () => {
      const startTime = Date.now();

      try {
        // Step 1: Check if we already have bypass cookie
        const alreadyBypassed = await CloudflareDetector.hasBypassCookie(url);
        if (alreadyBypassed) {
          log.info(`solve`, `Already have bypass cookie for ${url}`);
          return {
            success: true,
            cookies: await CookieManager.getCookies(url),
            duration: Date.now() - startTime,
          };
        }

        // Step 2: Trigger WebView bypass
        if (!this.webViewController) {
          log.error(
            `solve`,
            `WebView controller not registered - cannot bypass`,
          );
          return {
            success: false,
            error: 'WebView controller not available',
            duration: Date.now() - startTime,
          };
        }

        // Step 3: Start WebView challenge solving
        const result = await this.webViewController.solve(options);

        log.info(
          `solve`,
          `Bypass ${result.success ? 'succeeded' : 'failed'} for ${url} in ${result.duration}ms`,
        );

        return result;
      } catch (error) {
        log.error(`solve`, `Bypass error: ${error}`);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Check if bypass is currently active for a URL
   */
  static isActive(url: string): boolean {
    return stateManager.isActive(url);
  }

  /**
   * Cancel all active bypass attempts
   */
  static cancelAll(): void {
    stateManager.cancelAll();
  }
}

/**
 * Interface for WebView controller
 * Implemented by CloudflareWebView component
 */
export interface CloudflareWebViewController {
  solve(options: CloudflareBypassOptions): Promise<CloudflareBypassResult>;
}
