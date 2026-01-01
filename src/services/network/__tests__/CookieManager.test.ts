/**
 * CookieManager Unit Tests
 *
 * Tests the cookie persistence and management functionality.
 */

import CookieManagerLib from '@react-native-cookies/cookies';
import { CookieManager } from '../CookieManager';

// Mock the native cookie library
jest.mock('@react-native-cookies/cookies', () => ({
  get: jest.fn(),
  set: jest.fn(),
  clearAll: jest.fn(),
  flush: jest.fn(),
}));

describe('CookieManager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getCookies', () => {
    it('should return empty object when no cookies exist', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({});

      const result = await CookieManager.getCookies('https://example.com');

      expect(result).toEqual({});
      expect(CookieManagerLib.get).toHaveBeenCalledWith('https://example.com');
    });

    it('should convert cookie object to key-value pairs', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        session_id: {
          name: 'session_id',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
        },
        user_id: {
          name: 'user_id',
          value: 'xyz789',
          domain: 'example.com',
          path: '/',
        },
      });

      const result = await CookieManager.getCookies('https://example.com');

      expect(result).toEqual({
        session_id: 'abc123',
        user_id: 'xyz789',
      });
    });

    it('should handle malformed cookie data gracefully', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        valid_cookie: {
          name: 'valid_cookie',
          value: 'valid_value',
        },
        invalid_cookie: null,
        malformed_cookie: 'not-an-object',
      });

      const result = await CookieManager.getCookies('https://example.com');

      expect(result).toEqual({
        valid_cookie: 'valid_value',
      });
    });

    it('should return empty object on error', async () => {
      (CookieManagerLib.get as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await CookieManager.getCookies('https://example.com');

      expect(result).toEqual({});
    });

    it('should handle null response from native module', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue(null);

      const result = await CookieManager.getCookies('https://example.com');

      expect(result).toEqual({});
    });
  });

  describe('setCookies', () => {
    it('should set cookies with correct format', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      await CookieManager.setCookies('https://example.com', {
        session_id: 'abc123',
        user_id: 'xyz789',
      });

      expect(CookieManagerLib.set).toHaveBeenCalledTimes(2);
      expect(CookieManagerLib.set).toHaveBeenCalledWith('https://example.com', {
        name: 'session_id',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
      });
      expect(CookieManagerLib.set).toHaveBeenCalledWith('https://example.com', {
        name: 'user_id',
        value: 'xyz789',
        domain: 'example.com',
        path: '/',
      });
    });

    it('should handle empty cookies object', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      await CookieManager.setCookies('https://example.com', {});

      expect(CookieManagerLib.set).not.toHaveBeenCalled();
    });

    it('should throw error when setting cookies fails', async () => {
      (CookieManagerLib.set as jest.Mock).mockRejectedValue(
        new Error('Failed to set'),
      );

      await expect(
        CookieManager.setCookies('https://example.com', {
          session_id: 'abc123',
        }),
      ).rejects.toThrow();
    });

    it('should handle URLs with subdomains correctly', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      await CookieManager.setCookies('https://api.example.com/path', {
        token: 'secret',
      });

      expect(CookieManagerLib.set).toHaveBeenCalledWith(
        'https://api.example.com/path',
        {
          name: 'token',
          value: 'secret',
          domain: 'api.example.com',
          path: '/',
        },
      );
    });
  });

  describe('clearCookies', () => {
    it('should return 0 when no cookies to clear', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({});

      const count = await CookieManager.clearCookies('https://example.com');

      expect(count).toBe(0);
      expect(CookieManagerLib.set).not.toHaveBeenCalled();
    });

    it('should clear cookies by setting expired date', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        session_id: {
          name: 'session_id',
          value: 'abc123',
        },
        user_id: {
          name: 'user_id',
          value: 'xyz789',
        },
      });
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      const count = await CookieManager.clearCookies('https://example.com');

      expect(count).toBe(2);
      expect(CookieManagerLib.set).toHaveBeenCalledTimes(2);
      expect(CookieManagerLib.set).toHaveBeenCalledWith('https://example.com', {
        name: 'session_id',
        value: '',
        domain: 'example.com',
        path: '/',
        expires: new Date(0).toISOString(),
      });
    });

    it('should return correct count of cleared cookies', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        cookie1: { name: 'cookie1', value: 'value1' },
        cookie2: { name: 'cookie2', value: 'value2' },
        cookie3: { name: 'cookie3', value: 'value3' },
      });
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      const count = await CookieManager.clearCookies('https://example.com');

      expect(count).toBe(3);
    });

    it('should throw error when clearing fails', async () => {
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        session_id: { name: 'session_id', value: 'abc123' },
      });
      (CookieManagerLib.set as jest.Mock).mockRejectedValue(
        new Error('Clear failed'),
      );

      await expect(
        CookieManager.clearCookies('https://example.com'),
      ).rejects.toThrow();
    });
  });

  describe('clearAllCookies', () => {
    it('should call clearAll and flush', async () => {
      (CookieManagerLib.clearAll as jest.Mock).mockResolvedValue(true);
      (CookieManagerLib.flush as jest.Mock).mockResolvedValue(true);

      await CookieManager.clearAllCookies();

      expect(CookieManagerLib.clearAll).toHaveBeenCalledTimes(1);
      expect(CookieManagerLib.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw error when clearAll fails', async () => {
      (CookieManagerLib.clearAll as jest.Mock).mockRejectedValue(
        new Error('Failed'),
      );

      await expect(CookieManager.clearAllCookies()).rejects.toThrow();
    });

    it('should throw error when flush fails', async () => {
      (CookieManagerLib.clearAll as jest.Mock).mockResolvedValue(true);
      (CookieManagerLib.flush as jest.Mock).mockRejectedValue(
        new Error('Flush failed'),
      );

      await expect(CookieManager.clearAllCookies()).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle set-get-clear workflow', async () => {
      // Set cookies
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);
      await CookieManager.setCookies('https://example.com', {
        session: 'test123',
      });

      // Get cookies
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        session: { name: 'session', value: 'test123' },
      });
      const cookies = await CookieManager.getCookies('https://example.com');
      expect(cookies).toEqual({ session: 'test123' });

      // Clear cookies
      const count = await CookieManager.clearCookies('https://example.com');
      expect(count).toBe(1);
    });

    it('should handle multiple URLs independently', async () => {
      (CookieManagerLib.get as jest.Mock).mockImplementation((url: string) => {
        if (url === 'https://site1.com') {
          return Promise.resolve({
            cookie1: { name: 'cookie1', value: 'value1' },
          });
        } else if (url === 'https://site2.com') {
          return Promise.resolve({
            cookie2: { name: 'cookie2', value: 'value2' },
          });
        }
        return Promise.resolve({});
      });

      const site1Cookies = await CookieManager.getCookies('https://site1.com');
      const site2Cookies = await CookieManager.getCookies('https://site2.com');

      expect(site1Cookies).toEqual({ cookie1: 'value1' });
      expect(site2Cookies).toEqual({ cookie2: 'value2' });
    });

    it('should handle concurrent operations', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);
      (CookieManagerLib.get as jest.Mock).mockResolvedValue({
        test: { name: 'test', value: 'concurrent' },
      });

      // Perform multiple operations concurrently
      const results = await Promise.all([
        CookieManager.setCookies('https://example.com', { test: 'concurrent' }),
        CookieManager.getCookies('https://example.com'),
        CookieManager.getCookies('https://another.com'),
      ]);

      expect(results[1]).toEqual({ test: 'concurrent' });
      expect(results[2]).toEqual({ test: 'concurrent' });
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in cookie values', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      await CookieManager.setCookies('https://example.com', {
        special: 'value=with;special&chars',
      });

      expect(CookieManagerLib.set).toHaveBeenCalledWith('https://example.com', {
        name: 'special',
        value: 'value=with;special&chars',
        domain: 'example.com',
        path: '/',
      });
    });

    it('should handle URLs with ports', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);

      await CookieManager.setCookies('https://example.com:8080', {
        test: 'value',
      });

      expect(CookieManagerLib.set).toHaveBeenCalledWith(
        'https://example.com:8080',
        {
          name: 'test',
          value: 'value',
          domain: 'example.com',
          path: '/',
        },
      );
    });

    it('should handle very long cookie values', async () => {
      (CookieManagerLib.set as jest.Mock).mockResolvedValue(true);
      const longValue = 'x'.repeat(4000);

      await CookieManager.setCookies('https://example.com', {
        long_cookie: longValue,
      });

      expect(CookieManagerLib.set).toHaveBeenCalledWith('https://example.com', {
        name: 'long_cookie',
        value: longValue,
        domain: 'example.com',
        path: '/',
      });
    });
  });
});
