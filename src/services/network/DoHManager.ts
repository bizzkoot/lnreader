import { NativeModules, Platform } from 'react-native';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const rateLimitedLogger = createRateLimitedLogger('DoH');

const { DoHManager: NativeDoHManager } = NativeModules;

export enum DoHProvider {
  DISABLED = -1,
  CLOUDFLARE = 1,
  GOOGLE = 2,
  ADGUARD = 3,
}

export const DoHProviderNames: Record<DoHProvider, string> = {
  [DoHProvider.DISABLED]: 'Disabled (System DNS)',
  [DoHProvider.CLOUDFLARE]: 'Cloudflare (1.1.1.1)',
  [DoHProvider.GOOGLE]: 'Google (8.8.8.8)',
  [DoHProvider.ADGUARD]: 'AdGuard (94.140.14.140)',
};

export const DoHProviderDescriptions: Record<DoHProvider, string> = {
  [DoHProvider.DISABLED]: 'Use system DNS (default)',
  [DoHProvider.CLOUDFLARE]: 'Fast and privacy-focused DNS with WARP network',
  [DoHProvider.GOOGLE]: 'Reliable DNS with global infrastructure',
  [DoHProvider.ADGUARD]: 'Unfiltered DNS without ad blocking',
};

class DoHManagerService {
  /**
   * Set DNS-over-HTTPS provider
   * @param provider Provider ID from DoHProvider enum
   * @returns Promise<boolean> Success status
   */
  async setProvider(provider: DoHProvider): Promise<boolean> {
    if (Platform.OS !== 'android') {
      rateLimitedLogger.warn(
        'setProvider',
        'DoH is Android-only, cannot set provider',
      );
      return false;
    }

    if (!NativeDoHManager) {
      rateLimitedLogger.error(
        'setProvider',
        'DoHManager native module not available',
      );
      return false;
    }

    try {
      await NativeDoHManager.setProvider(provider);
      rateLimitedLogger.info(
        'setProvider',
        `DoH provider set to: ${DoHProviderNames[provider]}`,
      );
      return true;
    } catch (error) {
      rateLimitedLogger.error(
        'setProvider',
        'Failed to set DoH provider:',
        error,
      );
      return false;
    }
  }

  /**
   * Get current DoH provider
   * @returns Promise<DoHProvider> Current provider ID
   */
  async getProvider(): Promise<DoHProvider> {
    if (Platform.OS !== 'android') {
      return DoHProvider.DISABLED;
    }

    if (!NativeDoHManager) {
      rateLimitedLogger.error(
        'getProvider',
        'DoHManager native module not available',
      );
      return DoHProvider.DISABLED;
    }

    try {
      const provider = await NativeDoHManager.getProvider();
      return provider as DoHProvider;
    } catch (error) {
      rateLimitedLogger.error(
        'getProvider',
        'Failed to get DoH provider:',
        error,
      );
      return DoHProvider.DISABLED;
    }
  }

  /**
   * Clear DoH provider (fallback to system DNS)
   * @returns Promise<boolean> Success status
   */
  async clearProvider(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (!NativeDoHManager) {
      rateLimitedLogger.error(
        'clearProvider',
        'DoHManager native module not available',
      );
      return false;
    }

    try {
      await NativeDoHManager.clearProvider();
      rateLimitedLogger.info('clearProvider', 'DoH provider cleared');
      return true;
    } catch (error) {
      rateLimitedLogger.error(
        'clearProvider',
        'Failed to clear DoH provider:',
        error,
      );
      return false;
    }
  }

  /**
   * Check if DoH is supported on current platform
   * @returns boolean
   */
  isSupported(): boolean {
    return Platform.OS === 'android' && !!NativeDoHManager;
  }

  /**
   * Get friendly name for a provider
   * @param provider Provider ID
   * @returns string Friendly name
   */
  getProviderName(provider: DoHProvider): string {
    return DoHProviderNames[provider] || 'Unknown';
  }

  /**
   * Get description for a provider
   * @param provider Provider ID
   * @returns string Description
   */
  getProviderDescription(provider: DoHProvider): string {
    return DoHProviderDescriptions[provider] || '';
  }
}

export const DoHManager = new DoHManagerService();
