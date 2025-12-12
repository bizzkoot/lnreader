import {
  createWebViewNonce,
  parseWebViewMessage,
  createMessageRateLimiter,
  shouldAllowReaderWebViewRequest,
  shouldAllowExternalWebViewRequest,
} from '@utils/webviewSecurity';

describe('webviewSecurity', () => {
  describe('createWebViewNonce', () => {
    it('should return a 32-character hex string', () => {
      const nonce = createWebViewNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate different values on subsequent calls', () => {
      const a = createWebViewNonce();
      const b = createWebViewNonce();
      expect(a).not.toBe(b);
    });
  });

  describe('parseWebViewMessage', () => {
    it('should parse valid message with allowed type', () => {
      const raw = JSON.stringify({ type: 'save', data: 42, nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toEqual({ type: 'save', data: 42, nonce: 'abc123' });
    });

    it('should return null for disallowed type', () => {
      const raw = JSON.stringify({ type: 'evil', data: 1 });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const msg = parseWebViewMessage<'save', number>('notjson', [
        'save',
      ] as const);
      expect(msg).toBeNull();
    });

    it('should return null when nonce is not a string', () => {
      const raw = JSON.stringify({ type: 'save', nonce: 123 });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });
  });

  describe('createMessageRateLimiter', () => {
    it('should allow up to maxPerWindow messages', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 3,
        windowMs: 1000,
      });
      const now = Date.now();
      expect(limiter(now)).toBe(true);
      expect(limiter(now)).toBe(true);
      expect(limiter(now)).toBe(true);
      expect(limiter(now)).toBe(false); // 4th exceeds
    });

    it('should reset after window expires', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 2,
        windowMs: 1000,
      });
      const t0 = 1000;
      expect(limiter(t0)).toBe(true);
      expect(limiter(t0)).toBe(true);
      expect(limiter(t0)).toBe(false);
      // After window slides
      expect(limiter(t0 + 1001)).toBe(true);
    });
  });

  describe('shouldAllowReaderWebViewRequest', () => {
    it('should allow about:blank', () => {
      expect(shouldAllowReaderWebViewRequest({ url: 'about:blank' })).toBe(
        true,
      );
    });

    it('should allow file:// URLs', () => {
      expect(
        shouldAllowReaderWebViewRequest({
          url: 'file:///android_asset/index.html',
        }),
      ).toBe(true);
    });

    it('should block http:', () => {
      expect(
        shouldAllowReaderWebViewRequest({ url: 'http://example.com' }),
      ).toBe(false);
    });

    it('should block https:', () => {
      expect(shouldAllowReaderWebViewRequest({ url: 'https://evil.com' })).toBe(
        false,
      );
    });

    it('should block empty/undefined URLs', () => {
      expect(shouldAllowReaderWebViewRequest({ url: '' })).toBe(false);
      expect(shouldAllowReaderWebViewRequest({ url: undefined as any })).toBe(
        false,
      );
    });
  });

  describe('shouldAllowExternalWebViewRequest', () => {
    it('should allow https for allowed host', () => {
      const allowed = shouldAllowExternalWebViewRequest(
        { url: 'https://example.com/path' },
        ['example.com'],
      );
      expect(allowed).toBe(true);
    });

    it('should block https for non-allowed host', () => {
      const allowed = shouldAllowExternalWebViewRequest(
        { url: 'https://evil.com/path' },
        ['example.com'],
      );
      expect(allowed).toBe(false);
    });

    it('should block http regardless of host', () => {
      const allowed = shouldAllowExternalWebViewRequest(
        { url: 'http://example.com/path' },
        ['example.com'],
      );
      expect(allowed).toBe(false);
    });

    it('should allow about:blank and file://', () => {
      expect(
        shouldAllowExternalWebViewRequest({ url: 'about:blank' }, []),
      ).toBe(true);
      expect(
        shouldAllowExternalWebViewRequest({ url: 'file:///tmp' }, []),
      ).toBe(true);
    });
  });
});
