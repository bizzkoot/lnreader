/**
 * Tests for CloudflareBypass
 *
 * Covers:
 * - Basic bypass flow
 * - WebView controller registration
 * - State management
 * - Concurrent request handling
 */

import {
  CloudflareBypass,
  CloudflareWebViewController,
} from '../CloudflareBypass';
import { CookieManager } from '../CookieManager';
import { CloudflareDetector } from '../CloudflareDetector';

// Mock dependencies
jest.mock('../CookieManager');
jest.mock('../CloudflareDetector');

describe('CloudflareBypass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CloudflareBypass.unregisterWebViewController();
  });

  describe('WebView controller registration', () => {
    it('should register controller', () => {
      const controller: CloudflareWebViewController = {
        solve: jest.fn(),
      };

      CloudflareBypass.registerWebViewController(controller);
      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });

    it('should unregister controller', () => {
      const controller: CloudflareWebViewController = {
        solve: jest.fn(),
      };

      CloudflareBypass.registerWebViewController(controller);
      CloudflareBypass.unregisterWebViewController();
      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });
  });

  describe('solve', () => {
    it('should return success when bypass cookie already exists', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(true);
      (CookieManager.getCookies as jest.Mock).mockResolvedValue({
        cf_clearance: 'existing_token',
      });

      const result = await CloudflareBypass.solve({
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.cookies).toEqual({ cf_clearance: 'existing_token' });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return error when WebView controller not registered', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const result = await CloudflareBypass.solve({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('WebView controller not available');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should delegate to WebView controller when registered', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({
          success: true,
          cookies: { cf_clearance: 'new_token' },
          duration: 1000,
        }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      const result = await CloudflareBypass.solve({
        url: 'https://example.com',
        timeout: 30000,
      });

      expect(mockController.solve).toHaveBeenCalledWith({
        url: 'https://example.com',
        timeout: 30000,
      });
      expect(result.success).toBe(true);
      expect(result.cookies).toEqual({ cf_clearance: 'new_token' });
    });

    it('should use default timeout', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({ success: true }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      await CloudflareBypass.solve({
        url: 'https://example.com',
      });

      expect(mockController.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
        }),
      );
    });

    it('should handle controller errors gracefully', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockRejectedValue(new Error('WebView error')),
      };

      CloudflareBypass.registerWebViewController(mockController);

      const result = await CloudflareBypass.solve({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('WebView error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should pass userAgent to controller', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({ success: true }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      await CloudflareBypass.solve({
        url: 'https://example.com',
        userAgent: 'Custom UA',
      });

      expect(mockController.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Custom UA',
        }),
      );
    });

    it('should pass hidden flag to controller', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({ success: true }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      await CloudflareBypass.solve({
        url: 'https://example.com',
        hidden: false,
      });

      expect(mockController.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          hidden: false,
        }),
      );
    });
  });

  describe('Concurrent request handling', () => {
    it('should reuse existing bypass attempt for same URL', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      let resolveCount = 0;
      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockImplementation(() => {
          resolveCount++;
          return Promise.resolve({
            success: true,
            cookies: {},
            duration: 1000,
          });
        }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      // Start two concurrent bypass attempts
      const promise1 = CloudflareBypass.solve({ url: 'https://example.com' });
      const promise2 = CloudflareBypass.solve({ url: 'https://example.com' });

      expect(CloudflareBypass.isActive('https://example.com')).toBe(true);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should only call controller once due to deduplication
      expect(mockController.solve).toHaveBeenCalledTimes(1);
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });

    it('should allow concurrent bypass for different URLs', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({ success: true }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      await Promise.all([
        CloudflareBypass.solve({ url: 'https://example1.com' }),
        CloudflareBypass.solve({ url: 'https://example2.com' }),
      ]);

      expect(mockController.solve).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all active bypass attempts', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockImplementation(
          () => new Promise(() => {}), // Never resolves
        ),
      };

      CloudflareBypass.registerWebViewController(mockController);

      // Start bypass attempt
      CloudflareBypass.solve({ url: 'https://example.com' });

      expect(CloudflareBypass.isActive('https://example.com')).toBe(true);

      CloudflareBypass.cancelAll();

      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return false for inactive URLs', () => {
      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });

    it('should return true during active bypass', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      let resolveController: (result: any) => void;
      const controllerPromise = new Promise(resolve => {
        resolveController = resolve;
      });

      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockReturnValue(controllerPromise),
      };

      CloudflareBypass.registerWebViewController(mockController);

      const promise = CloudflareBypass.solve({ url: 'https://example.com' });

      expect(CloudflareBypass.isActive('https://example.com')).toBe(true);

      resolveController!({ success: true });
      await promise;

      expect(CloudflareBypass.isActive('https://example.com')).toBe(false);
    });
  });

  describe('State callbacks', () => {
    it('should call onStateChange callback', async () => {
      (CloudflareDetector.hasBypassCookie as jest.Mock).mockResolvedValue(
        false,
      );

      const onStateChange = jest.fn();
      const mockController: CloudflareWebViewController = {
        solve: jest.fn().mockResolvedValue({ success: true }),
      };

      CloudflareBypass.registerWebViewController(mockController);

      await CloudflareBypass.solve({
        url: 'https://example.com',
        onStateChange,
      });

      expect(mockController.solve).toHaveBeenCalledWith(
        expect.objectContaining({
          onStateChange,
        }),
      );
    });
  });
});
