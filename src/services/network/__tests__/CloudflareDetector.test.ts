/**
 * Tests for CloudflareDetector
 *
 * Covers:
 * - Challenge detection (status + headers)
 * - Body content detection (fallback)
 * - Bypass cookie checking
 * - Cookie clearing
 */

import { CloudflareDetector } from '../CloudflareDetector';
import { CookieManager } from '../CookieManager';

// Mock CookieManager
jest.mock('../CookieManager');

describe('CloudflareDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isChallenge', () => {
    it('should detect 403 with cloudflare server header', () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'cloudflare',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
    });

    it('should detect 503 with cloudflare-nginx server header', () => {
      const response = new Response('', {
        status: 503,
        headers: {
          Server: 'cloudflare-nginx',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
    });

    it('should be case-insensitive for server header', () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'CLOUDFLARE-NGINX',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
    });

    it('should not detect non-403/503 status codes', () => {
      const response = new Response('', {
        status: 200,
        headers: {
          Server: 'cloudflare',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(false);
    });

    it('should not detect 403 without cloudflare header', () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'nginx',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(false);
    });

    it('should handle missing server header', () => {
      const response = new Response('', {
        status: 403,
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(false);
    });

    it('should detect partial match in server header', () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'cloudflare-nginx/1.0',
        },
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
    });
  });

  describe('isChallengePage', () => {
    it('should detect "Just a moment..." in body', () => {
      const body = '<html><body>Just a moment...</body></html>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(true);
    });

    it('should detect "Checking your browser" in body', () => {
      const body =
        '<html><body>Checking your browser before accessing...</body></html>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(true);
    });

    it('should detect "cf-browser-verification" in body', () => {
      const body = '<div id="cf-browser-verification">Loading...</div>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(true);
    });

    it('should detect "challenge-platform" in body', () => {
      const body = '<script src="/challenge-platform/h/b/..."></script>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(true);
    });

    it('should not detect normal pages', () => {
      const body = '<html><body>Normal page content</body></html>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(false);
    });

    it('should be case-sensitive for body signatures', () => {
      const body = '<html><body>just a moment...</body></html>';
      expect(CloudflareDetector.isChallengePage(body)).toBe(false);
    });
  });

  describe('hasBypassCookie', () => {
    it('should return true when cf_clearance exists', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'abc123',
        other_cookie: 'xyz',
      });

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(true);
    });

    it('should return true when __cf_bm exists', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        __cf_bm: 'def456',
        session: '789',
      });

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(true);
    });

    it('should return true when both cf cookies exist', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'abc123',
        __cf_bm: 'def456',
      });

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(true);
    });

    it('should return false when no cf cookies exist', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        session: '123',
        other: 'value',
      });

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(false);
    });

    it('should return false when no cookies exist', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(false);
    });

    it('should handle CookieManager errors gracefully', async () => {
      (CookieManager.getCookies as jest.Mock).mockRejectedValue(
        new Error('Cookie error'),
      );

      const result = await CloudflareDetector.hasBypassCookie(
        'https://example.com',
      );
      expect(result).toBe(false);
    });
  });

  describe('clearBypassCookie', () => {
    it('should clear cookies for URL', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'abc123',
        __cf_bm: 'def456',
        session: '789',
      });

      await CloudflareDetector.clearBypassCookie('https://example.com');

      expect(CookieManager.clearCookies).toHaveBeenCalledWith(
        'https://example.com',
      );
    });

    it('should handle errors when clearing cookies', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'abc123',
      });
      (CookieManager.clearCookies as jest.Mock).mockRejectedValue(
        new Error('Clear error'),
      );

      await expect(
        CloudflareDetector.clearBypassCookie('https://example.com'),
      ).rejects.toThrow('Clear error');
    });
  });

  describe('getCloudflareRayId', () => {
    it('should extract CF-RAY header', () => {
      const response = new Response('', {
        headers: {
          'CF-RAY': '1234567890abcdef-LAX',
        },
      });

      expect(CloudflareDetector.getCloudflareRayId(response)).toBe(
        '1234567890abcdef-LAX',
      );
    });

    it('should return null when CF-RAY header missing', () => {
      const response = new Response('', {
        headers: {},
      });

      expect(CloudflareDetector.getCloudflareRayId(response)).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should detect challenge and have no bypass cookie', async () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'cloudflare',
        },
      });

      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
      expect(
        await CloudflareDetector.hasBypassCookie('https://example.com'),
      ).toBe(false);
    });

    it('should detect challenge but have valid bypass cookie', async () => {
      const response = new Response('', {
        status: 403,
        headers: {
          Server: 'cloudflare',
        },
      });

      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'valid_token',
      });

      expect(CloudflareDetector.isChallenge(response)).toBe(true);
      expect(
        await CloudflareDetector.hasBypassCookie('https://example.com'),
      ).toBe(true);
    });
  });
});
