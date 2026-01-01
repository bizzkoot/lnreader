/**
 * fetchApi Cookie Integration Tests
 *
 * Tests automatic cookie injection and saving in fetchApi.
 */

import { fetchApi } from '../fetch';
import { CookieManager } from '@services/network/CookieManager';

// Mock global fetch
global.fetch = jest.fn();

// Mock getUserAgent
jest.mock('@hooks/persisted/useUserAgent', () => ({
  getUserAgent: jest.fn(() => 'Mozilla/5.0 (Test User Agent)'),
}));

// Mock CookieManager
jest.mock('@services/network/CookieManager', () => ({
  CookieManager: {
    getCookies: jest.fn(),
    setCookies: jest.fn(),
    clearCookies: jest.fn(),
    clearAllCookies: jest.fn(),
  },
}));

describe('fetchApi - Cookie Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CookieManager.getCookies as jest.Mock).mockResolvedValue({});
    (CookieManager.setCookies as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Cookie Injection', () => {
    it('should inject cookies into request headers', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        session_id: 'abc123',
        user_id: 'xyz789',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      expect(CookieManager.getCookies).toHaveBeenCalledWith(
        'https://example.com/api/data',
      );
      expect(global.fetch).toHaveBeenCalled();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers.Cookie).toBe('session_id=abc123; user_id=xyz789');
    });

    it('should not modify headers when no cookies exist', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers.Cookie).toBeUndefined();
    });

    it('should inject cookies when using Headers object', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        token: 'secret123',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      const customHeaders = new Headers({
        'Content-Type': 'application/json',
      });

      // Execute
      await fetchApi('https://example.com/api/data', {
        headers: customHeaders,
      });

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers.get('Cookie')).toBe('token=secret123');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should preserve existing headers when injecting cookies', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        auth: 'token',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      });

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Cookie']).toBe('auth=token');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should not fail request when cookie injection fails', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      });

      // Execute
      const response = await fetchApi('https://example.com/api/data');

      // Verify - request should still succeed
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Cookie Saving', () => {
    it('should save cookies from Set-Cookie header', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const mockHeaders = new Headers();
      mockHeaders.set('set-cookie', 'session_id=new_session; Path=/; HttpOnly');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute
      await fetchApi('https://example.com/api/login');

      // Verify
      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com/api/login',
        {
          session_id: 'new_session',
        },
      );
    });

    it('should save multiple cookies from Set-Cookie header', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const mockHeaders = new Headers();
      mockHeaders.set(
        'set-cookie',
        'session_id=abc123; Path=/,user_pref=dark_mode; Path=/',
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute
      await fetchApi('https://example.com/api/login');

      // Verify
      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com/api/login',
        {
          session_id: 'abc123',
          user_pref: 'dark_mode',
        },
      );
    });

    it('should not save cookies when Set-Cookie header is absent', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      expect(CookieManager.setCookies).not.toHaveBeenCalled();
    });

    it('should handle malformed Set-Cookie header gracefully', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const mockHeaders = new Headers();
      mockHeaders.set(
        'set-cookie',
        'invalid_cookie_without_equals_sign; Path=/',
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify - should not call setCookies with empty object
      expect(CookieManager.setCookies).not.toHaveBeenCalled();
    });

    it('should not fail request when cookie saving fails', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});
      (CookieManager.setCookies as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const mockHeaders = new Headers();
      mockHeaders.set('set-cookie', 'session_id=abc123; Path=/');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: mockHeaders,
      });

      // Execute
      const response = await fetchApi('https://example.com/api/login');

      // Verify - request should still succeed
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should handle Set-Cookie with cookie attributes correctly', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const mockHeaders = new Headers();
      mockHeaders.set(
        'set-cookie',
        'auth_token=xyz789; Path=/; Domain=example.com; Secure; HttpOnly; SameSite=Strict',
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute
      await fetchApi('https://example.com/api/auth');

      // Verify - should extract only name=value, ignore attributes
      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com/api/auth',
        {
          auth_token: 'xyz789',
        },
      );
    });
  });

  describe('Cookie Lifecycle', () => {
    it('should handle full cookie lifecycle: inject -> request -> save', async () => {
      // Setup - first request with no cookies
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      const mockHeaders = new Headers();
      mockHeaders.set('set-cookie', 'session_id=new_session; Path=/');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute first request
      await fetchApi('https://example.com/api/login');

      // Verify cookies were saved
      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com/api/login',
        {
          session_id: 'new_session',
        },
      );

      // Setup second request with saved cookies
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        session_id: 'new_session',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute second request
      await fetchApi('https://example.com/api/data');

      // Verify cookies were injected
      const fetchCall = (global.fetch as jest.Mock).mock.calls[1];
      const headers = fetchCall[1].headers;
      expect(headers.Cookie).toBe('session_id=new_session');
    });

    it('should update cookies when server sends new Set-Cookie', async () => {
      // Setup - existing cookies
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        session_id: 'old_session',
      });

      const mockHeaders = new Headers();
      mockHeaders.set('set-cookie', 'session_id=updated_session; Path=/');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: mockHeaders,
      });

      // Execute
      await fetchApi('https://example.com/api/refresh');

      // Verify
      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com/api/refresh',
        {
          session_id: 'updated_session',
        },
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cookie values', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        empty_cookie: '',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Cookie).toBe('empty_cookie=');
    });

    it('should handle special characters in cookie values', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        special: 'value=with;special&chars',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Cookie).toBe('special=value=with;special&chars');
    });

    it('should work with different URL formats', async () => {
      const urls = [
        'https://example.com',
        'https://example.com/',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://subdomain.example.com/path',
        'https://example.com:8080/path',
      ];

      for (const url of urls) {
        (CookieManager.getCookies as jest.Mock).mockResolvedValue({
          test: 'value',
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          headers: new Headers(),
        });

        await fetchApi(url);

        expect(CookieManager.getCookies).toHaveBeenCalledWith(url);
      }
    });

    it('should handle concurrent requests independently', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockImplementation(
        (url: string) => {
          if (url.includes('site1')) {
            return Promise.resolve({ cookie1: 'value1' });
          } else {
            return Promise.resolve({ cookie2: 'value2' });
          }
        },
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute concurrent requests
      await Promise.all([
        fetchApi('https://site1.com/api'),
        fetchApi('https://site2.com/api'),
      ]);

      // Verify
      expect(CookieManager.getCookies).toHaveBeenCalledWith(
        'https://site1.com/api',
      );
      expect(CookieManager.getCookies).toHaveBeenCalledWith(
        'https://site2.com/api',
      );

      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls[0][1].headers.Cookie).toBe('cookie1=value1');
      expect(fetchCalls[1][1].headers.Cookie).toBe('cookie2=value2');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work exactly like before when no cookies exist', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      });

      // Execute
      const response = await fetchApi('https://example.com/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      // Verify - should behave identically to old implementation
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ test: 'data' }),
        }),
      );
    });

    it('should preserve all default headers', async () => {
      // Setup
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({});

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers(),
      });

      // Execute
      await fetchApi('https://example.com/api/data');

      // Verify
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['Connection']).toBe('keep-alive');
      expect(headers['Accept']).toBe('*/*');
      expect(headers['Accept-Language']).toBe('*');
      expect(headers['Sec-Fetch-Mode']).toBe('cors');
      expect(headers['Accept-Encoding']).toBe('gzip, deflate');
      expect(headers['Cache-Control']).toBe('max-age=0');
      expect(headers['User-Agent']).toBeDefined();
    });
  });
});
