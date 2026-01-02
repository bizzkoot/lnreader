/**
 * Integration tests for fetchApi Cloudflare bypass flow
 *
 * Tests the complete flow:
 * 1. fetchApi detects Cloudflare challenge
 * 2. CloudflareBypass.solve() is called
 * 3. Cookies are obtained
 * 4. Request is retried with cookies
 */

import { fetchApi } from '../../plugins/helpers/fetch';
import { CookieManager } from '../network/CookieManager';
import { CloudflareDetector } from '../network/CloudflareDetector';
import { CloudflareBypass } from '../network/CloudflareBypass';

// Mock dependencies
jest.mock('../network/CookieManager');
jest.mock('../network/CloudflareDetector');
jest.mock('../network/CloudflareBypass');
jest.mock('../../hooks/persisted/useUserAgent', () => ({
  getUserAgent: jest.fn(() => 'Mozilla/5.0'),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('fetchApi Cloudflare bypass integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (CookieManager.getCookies as jest.Mock).mockResolvedValue({});
    (CookieManager.setCookies as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Normal flow (no challenge)', () => {
    it('should complete request without bypass', async () => {
      const mockResponse = new Response('OK', {
        status: 200,
        headers: { Server: 'nginx' },
      });

      mockFetch.mockResolvedValue(mockResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(false);

      const response = await fetchApi('https://example.com');

      expect(response.status).toBe(200);
      expect(CloudflareBypass.solve).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should inject existing cookies', async () => {
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        session: 'abc123',
        user_id: 'xyz789',
      });

      const mockResponse = new Response('OK', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(false);

      await fetchApi('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=abc123; user_id=xyz789',
          }),
        }),
      );
    });

    it('should save Set-Cookie headers', async () => {
      const mockResponse = new Response('OK', {
        status: 200,
        headers: {
          'set-cookie': 'new_cookie=value123; Path=/; HttpOnly',
        },
      });

      mockFetch.mockResolvedValue(mockResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(false);

      await fetchApi('https://example.com');

      expect(CookieManager.setCookies).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          new_cookie: 'value123',
        }),
      );
    });
  });

  describe('Cloudflare bypass flow', () => {
    it('should detect challenge and trigger bypass', async () => {
      // First request: Cloudflare challenge
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      // Second request: Success after bypass
      const successResponse = new Response('OK', { status: 200 });

      mockFetch
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(successResponse);

      (CloudflareDetector.isChallenge as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: true,
        cookies: { cf_clearance: 'bypass_token' },
        duration: 1000,
      });

      const response = await fetchApi('https://example.com');

      expect(CloudflareDetector.isChallenge).toHaveBeenCalledWith(
        challengeResponse,
      );
      expect(CloudflareBypass.solve).toHaveBeenCalledWith({
        url: 'https://example.com',
        timeout: 30000,
        hidden: true,
        userAgent: expect.any(String),
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should retry with bypass cookies', async () => {
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      const successResponse = new Response('OK', { status: 200 });

      mockFetch
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(successResponse);

      (CloudflareDetector.isChallenge as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: true,
        cookies: { cf_clearance: 'bypass_token' },
      });

      // On retry, return bypass cookie
      (CookieManager.getCookies as jest.Mock)
        .mockResolvedValueOnce({}) // First request: no cookies
        .mockResolvedValueOnce({ cf_clearance: 'bypass_token' }); // Retry: has cookie

      await fetchApi('https://example.com');

      // Second fetch should include bypass cookie
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'cf_clearance=bypass_token',
          }),
        }),
      );
    });

    it('should return original response when bypass fails', async () => {
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      mockFetch.mockResolvedValue(challengeResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(true);
      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Timeout',
      });

      const response = await fetchApi('https://example.com');

      expect(CloudflareBypass.solve).toHaveBeenCalled();
      expect(response.status).toBe(403);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should pass custom User-Agent to bypass', async () => {
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      mockFetch.mockResolvedValue(challengeResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(true);
      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: false,
      });

      await fetchApi('https://example.com', {
        headers: {
          'User-Agent': 'Custom UA',
        },
      });

      expect(CloudflareBypass.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Custom UA',
        }),
      );
    });

    it('should handle Headers object for User-Agent', async () => {
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      mockFetch.mockResolvedValue(challengeResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(true);
      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: false,
      });

      const headers = new Headers();
      headers.set('User-Agent', 'Headers UA');

      await fetchApi('https://example.com', { headers });

      expect(CloudflareBypass.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Headers UA',
        }),
      );
    });
  });

  describe('Error handling', () => {
    it('should handle cookie injection errors gracefully', async () => {
      (CookieManager.getCookies as jest.Mock).mockRejectedValue(
        new Error('Cookie error'),
      );

      const mockResponse = new Response('OK', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(false);

      const response = await fetchApi('https://example.com');

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle cookie saving errors gracefully', async () => {
      const mockResponse = new Response('OK', {
        status: 200,
        headers: {
          'set-cookie': 'cookie=value',
        },
      });

      mockFetch.mockResolvedValue(mockResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(false);
      (CookieManager.setCookies as jest.Mock).mockRejectedValue(
        new Error('Save error'),
      );

      const response = await fetchApi('https://example.com');

      expect(response.status).toBe(200);
    });

    it('should handle bypass errors and return original response', async () => {
      const challengeResponse = new Response('Challenge', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      mockFetch.mockResolvedValue(challengeResponse);
      (CloudflareDetector.isChallenge as jest.Mock).mockReturnValue(true);
      (CloudflareBypass.solve as jest.Mock).mockRejectedValue(
        new Error('Bypass error'),
      );

      // Should not throw - returns original response
      const response = await fetchApi('https://example.com');
      expect(response.status).toBe(403);
    });
  });

  describe('Multiple redirects scenario', () => {
    it('should handle multiple Cloudflare challenges', async () => {
      // First challenge
      const challenge1 = new Response('Challenge 1', {
        status: 403,
        headers: { Server: 'cloudflare' },
      });

      // Second challenge after first bypass
      const challenge2 = new Response('Challenge 2', {
        status: 503,
        headers: { Server: 'cloudflare' },
      });

      // Final success
      const success = new Response('OK', { status: 200 });

      mockFetch
        .mockResolvedValueOnce(challenge1)
        .mockResolvedValueOnce(challenge2)
        .mockResolvedValueOnce(success);

      (CloudflareDetector.isChallenge as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      (CloudflareBypass.solve as jest.Mock).mockResolvedValue({
        success: true,
        cookies: { cf_clearance: 'token' },
      });

      const response = await fetchApi('https://example.com');

      expect(CloudflareBypass.solve).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(200);
    });
  });
});
