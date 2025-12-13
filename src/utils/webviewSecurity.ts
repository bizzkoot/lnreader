import { Linking } from 'react-native';

type WebViewNavLike = {
  url: string;
  isTopFrame?: boolean;
  navigationType?: string;
};

export type WebViewInboundMessage<
  TType extends string = string,
  TData = unknown,
> = {
  type: TType;
  data?: TData;
  nonce?: string;
};

export const READER_WEBVIEW_ORIGIN_WHITELIST = ['about:blank', 'file://*'];

export function createWebViewNonce(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildWebViewPostMessageInject(
  message: WebViewInboundMessage,
): string {
  return `
    (function(){
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(${JSON.stringify(
            message,
          )}));
        }
      } catch (e) {}
    })();
    true;
  `;
}

export function buildWebViewWindowInjection(
  name: string,
  value: unknown,
): string {
  return `
    (function(){
      try {
        window[${JSON.stringify(name)}] = ${JSON.stringify(value)};
      } catch (e) {}
    })();
    true;
  `;
}

export function shouldAllowReaderWebViewRequest(req: WebViewNavLike): boolean {
  const url = req?.url ?? '';
  if (!url) {
    return false;
  }

  // Reader should never navigate to remote content.
  if (url.startsWith('http://')) {
    return false;
  }
  if (url.startsWith('https://')) {
    return false;
  }

  // Allow internal/local schemes only.
  if (url.startsWith('about:blank')) {
    return true;
  }
  if (url.startsWith('file://')) {
    return true;
  }

  return false;
}

export function shouldAllowExternalWebViewRequest(
  req: WebViewNavLike,
  allowedHosts: string[],
): boolean {
  const url = req?.url ?? '';
  if (!url) {
    return false;
  }

  // Never allow cleartext.
  if (url.startsWith('http://')) {
    return false;
  }

  // Allow same-document and local.
  if (url.startsWith('about:blank') || url.startsWith('file://')) {
    return true;
  }

  if (!url.startsWith('https://')) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return allowedHosts.includes(parsed.host);
  } catch {
    return false;
  }
}

export function openExternalUrlSafely(url: string): void {
  if (!url) {
    return;
  }
  // Avoid exceptions/invalid schemes; let OS handle only safe links.
  if (url.startsWith('https://')) {
    void Linking.openURL(url);
  }
}

export function parseWebViewMessage<TType extends string, TData>(
  raw: string,
  allowedTypes: readonly TType[],
): WebViewInboundMessage<TType, TData> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const type = obj.type;
    if (typeof type !== 'string') {
      return null;
    }
    if (!allowedTypes.includes(type as TType)) {
      return null;
    }
    const nonce = obj.nonce;
    if (nonce !== undefined && typeof nonce !== 'string') {
      return null;
    }
    return {
      type: type as TType,
      data: obj.data as TData,
      nonce: nonce as string | undefined,
    };
  } catch {
    return null;
  }
}

export function createMessageRateLimiter(opts?: {
  maxPerWindow?: number;
  windowMs?: number;
}): (nowMs: number) => boolean {
  const maxPerWindow = opts?.maxPerWindow ?? 80;
  const windowMs = opts?.windowMs ?? 1000;
  let windowStart = 0;
  let count = 0;
  return (nowMs: number) => {
    if (nowMs - windowStart > windowMs) {
      windowStart = nowMs;
      count = 0;
    }
    count += 1;
    return count <= maxPerWindow;
  };
}
