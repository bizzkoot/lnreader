/**
 * Cloudflare WebView Component
 *
 * WebView-based Cloudflare challenge solver with two modes:
 * 1. Hidden mode: opacity: 0 for automatic JS challenge solving
 * 2. Modal mode: Full-screen modal for interactive challenges (CAPTCHA)
 *
 * Features:
 * - Automatic cf_clearance cookie detection
 * - document.cookie extraction via injected JavaScript
 * - Timeout handling (default: 30s)
 * - Progress tracking and state callbacks
 *
 * Reference: specs/network-cookie-handling/10-CLOUDFLARE-BYPASS-RESEARCH.md
 */

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { Portal } from 'react-native-paper';
import { CookieManager } from '@services/network/CookieManager';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import {
  CloudflareBypassResult,
  CloudflareBypassOptions,
  CloudflareBypassState,
  CloudflareBypass,
  CloudflareWebViewController,
} from '@services/network/CloudflareBypass';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import AppText from '@components/AppText';
import { useTheme } from '@hooks/persisted';

const log = createRateLimitedLogger('CloudflareWebView');

/**
 * JavaScript code to extract cookies from WebView
 */
const INJECT_COOKIE_EXTRACTION = `
  (function() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cf_cookies',
        url: window.location.href,
        cookies: document.cookie
      }));
    } catch (e) {
      console.error('Cookie extraction failed:', e);
    }
  })();
  true;
`;

interface CloudflareWebViewProps {
  /**
   * Whether component is enabled (registers controller when true)
   */
  enabled?: boolean;
}

export interface CloudflareWebViewHandle {
  solve(options: CloudflareBypassOptions): Promise<CloudflareBypassResult>;
}

/**
 * Cloudflare WebView Component
 *
 * Renders hidden WebView for automatic challenge solving.
 * Shows modal when needed for interactive challenges.
 */
const CloudflareWebView = forwardRef<
  CloudflareWebViewHandle,
  CloudflareWebViewProps
>(({ enabled = true }, ref) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [visible, setVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [hidden, setHidden] = useState(true);
  const [state, setState] = useState<CloudflareBypassState>(
    CloudflareBypassState.IDLE,
  );

  // Promise resolvers for async solve method
  const resolverRef = useRef<{
    resolve: (result: CloudflareBypassResult) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const checkingRef = useRef(false);
  const optionsRef = useRef<CloudflareBypassOptions | null>(null);

  /**
   * Check for cf_clearance cookie
   */
  const checkBypassCookie = useCallback(async (url: string) => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const cookies = await CookieManager.getCookies(url);

      if (cookies.cf_clearance || cookies.__cf_bm) {
        log.info(
          `checkBypassCookie`,
          `Bypass cookie detected: cf_clearance=${!!cookies.cf_clearance}, __cf_bm=${!!cookies.__cf_bm}`,
        );

        const duration = Date.now() - startTimeRef.current;
        clearTimeout(timeoutRef.current);

        setState(CloudflareBypassState.SUCCESS);
        optionsRef.current?.onStateChange?.(CloudflareBypassState.SUCCESS);

        // Resolve promise
        resolverRef.current?.resolve({
          success: true,
          cookies,
          duration,
        });

        // Cleanup
        setTimeout(() => {
          setVisible(false);
          setState(CloudflareBypassState.IDLE);
        }, 500);
      }
    } catch (error) {
      log.error(`checkBypassCookie`, `Error: ${error}`);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  /**
   * Handle WebView messages
   */
  const handleMessage = useCallback(
    async (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'cf_cookies' && data.cookies) {
          const cookies: Record<string, string> = {};
          data.cookies.split(';').forEach((c: string) => {
            const [name, value] = c.trim().split('=');
            if (name && value) cookies[name] = value;
          });

          // Save cookies to CookieManager
          if (Object.keys(cookies).length > 0) {
            await CookieManager.setCookies(data.url, cookies);
          }

          // Check for bypass cookies
          if (cookies.cf_clearance || cookies.__cf_bm) {
            await checkBypassCookie(data.url);
          }
        }
      } catch (error) {
        log.error(`handleMessage`, `Error: ${error}`);
      }
    },
    [checkBypassCookie],
  );

  /**
   * Handle WebView navigation state change
   */
  const handleNavigationChange = useCallback(
    (navState: WebViewNavigation) => {
      if (!navState.loading) {
        // Page loaded - inject cookie extraction
        webViewRef.current?.injectJavaScript(INJECT_COOKIE_EXTRACTION);
        checkBypassCookie(navState.url);
      }
    },
    [checkBypassCookie],
  );

  /**
   * Handle timeout
   */
  const handleTimeout = useCallback(() => {
    log.warn(`handleTimeout`, `Bypass timeout after 30s`);

    const duration = Date.now() - startTimeRef.current;
    setState(CloudflareBypassState.TIMEOUT);
    optionsRef.current?.onStateChange?.(CloudflareBypassState.TIMEOUT);

    resolverRef.current?.resolve({
      success: false,
      error: 'Timeout waiting for cf_clearance cookie',
      duration,
    });

    setVisible(false);
    setState(CloudflareBypassState.IDLE);
  }, []);

  /**
   * Handle manual close (user cancels)
   */
  const handleClose = useCallback(() => {
    log.info(`handleClose`, `User cancelled bypass`);

    const duration = Date.now() - startTimeRef.current;
    clearTimeout(timeoutRef.current);

    setState(CloudflareBypassState.FAILED);
    optionsRef.current?.onStateChange?.(CloudflareBypassState.FAILED);

    resolverRef.current?.resolve({
      success: false,
      error: 'User cancelled bypass',
      duration,
    });

    setVisible(false);
    setState(CloudflareBypassState.IDLE);
  }, []);

  /**
   * Imperative handle for parent components
   */
  useImperativeHandle(
    ref,
    (): CloudflareWebViewController => ({
      async solve(
        options: CloudflareBypassOptions,
      ): Promise<CloudflareBypassResult> {
        return new Promise((resolve, reject) => {
          log.info(`solve`, `Starting bypass for ${options.url}`);

          // Store options and resolvers
          optionsRef.current = options;
          resolverRef.current = { resolve, reject };
          startTimeRef.current = Date.now();

          // Setup timeout
          const timeout = options.timeout || CloudflareBypass.DEFAULT_TIMEOUT;
          timeoutRef.current = setTimeout(handleTimeout, timeout);

          // Configure WebView
          setCurrentUrl(options.url);
          setHidden(options.hidden ?? true);
          setState(CloudflareBypassState.LOADING);
          options.onStateChange?.(CloudflareBypassState.LOADING);

          // Show WebView
          setVisible(true);
        });
      },
    }),
    [handleTimeout],
  );

  /**
   * Register/unregister controller
   */
  useEffect(() => {
    if (enabled) {
      const controller: CloudflareWebViewController = {
        solve: async options => {
          return new Promise((resolve, reject) => {
            log.info(`solve`, `Starting bypass for ${options.url}`);

            optionsRef.current = options;
            resolverRef.current = { resolve, reject };
            startTimeRef.current = Date.now();

            const timeout = options.timeout || CloudflareBypass.DEFAULT_TIMEOUT;
            timeoutRef.current = setTimeout(handleTimeout, timeout);

            setCurrentUrl(options.url);
            setHidden(options.hidden ?? true);
            setState(CloudflareBypassState.LOADING);
            options.onStateChange?.(CloudflareBypassState.LOADING);

            setVisible(true);
          });
        },
      };

      CloudflareBypass.registerWebViewController(controller);

      return () => {
        CloudflareBypass.unregisterWebViewController();
        clearTimeout(timeoutRef.current);
      };
    }
  }, [enabled, handleTimeout]);

  /**
   * Update state when solving
   */
  useEffect(() => {
    if (visible && state === CloudflareBypassState.LOADING) {
      // After 2 seconds, assume challenge is being solved
      const timer = setTimeout(() => {
        if (state === CloudflareBypassState.LOADING) {
          setState(CloudflareBypassState.SOLVING);
          optionsRef.current?.onStateChange?.(CloudflareBypassState.SOLVING);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible, state]);

  if (!visible || !currentUrl) {
    return null;
  }

  const webViewComponent = (
    <WebView
      ref={webViewRef}
      source={{ uri: currentUrl }}
      userAgent={optionsRef.current?.userAgent || getUserAgent()}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      thirdPartyCookiesEnabled={true}
      sharedCookiesEnabled={true}
      onNavigationStateChange={handleNavigationChange}
      onMessage={handleMessage}
      style={hidden ? styles.hiddenWebView : styles.webView}
      setSupportMultipleWindows={false}
    />
  );

  // Hidden mode: render WebView offscreen
  if (hidden) {
    return <View style={styles.hiddenContainer}>{webViewComponent}</View>;
  }

  // Modal mode: full-screen WebView with header
  return (
    <Portal>
      <Modal
        visible={true}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.surface }]}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.primary,
                borderBottomColor: theme.outline,
              },
            ]}
          >
            <View style={styles.headerLeft}>
              {state === CloudflareBypassState.SOLVING ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : null}
              <AppText style={[styles.title, { color: theme.onPrimary }]}>
                {state === CloudflareBypassState.LOADING
                  ? 'Loading...'
                  : state === CloudflareBypassState.SOLVING
                    ? 'Verifying Connection...'
                    : 'Cloudflare Challenge'}
              </AppText>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <AppText style={[styles.closeText, { color: theme.onPrimary }]}>
                Cancel
              </AppText>
            </Pressable>
          </View>
          {webViewComponent}
        </View>
      </Modal>
    </Portal>
  );
});

CloudflareWebView.displayName = 'CloudflareWebView';

export default CloudflareWebView;

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -9999,
    top: -9999,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  webView: {
    flex: 1,
  },
});
