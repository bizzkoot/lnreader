import * as Notifications from 'expo-notifications';
import {
  updateTTSCategory,
  showTTSNotification,
  updateTTSNotification,
  dismissTTSNotification,
  setTTSAction,
  getTTSAction,
  clearTTSAction,
  TTSNotificationData,
} from '../ttsNotification';

// Mock dependencies
jest.mock('expo-notifications', () => ({
  setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  AndroidNotificationPriority: {
    HIGH: 'high',
  },
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('ttsNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTTSCategory', () => {
    it('should update notification category with play button when not playing', async () => {
      const mockSetNotificationCategoryAsync =
        Notifications.setNotificationCategoryAsync as jest.Mock;
      mockSetNotificationCategoryAsync.mockResolvedValue(undefined);

      await updateTTSCategory(false);

      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        'TTS_CONTROLS',
        [
          expect.objectContaining({
            identifier: 'TTS_PLAY_PAUSE',
            buttonTitle: '▶️ Play',
          }),
          expect.objectContaining({
            identifier: 'TTS_STOP',
            buttonTitle: '⏹️ Stop',
          }),
          expect.objectContaining({
            identifier: 'TTS_NEXT',
            buttonTitle: '⏭️ Next',
          }),
        ],
      );
    });

    it('should update notification category with pause button when playing', async () => {
      const mockSetNotificationCategoryAsync =
        Notifications.setNotificationCategoryAsync as jest.Mock;
      mockSetNotificationCategoryAsync.mockResolvedValue(undefined);

      await updateTTSCategory(true);

      expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
        'TTS_CONTROLS',
        [
          expect.objectContaining({
            identifier: 'TTS_PLAY_PAUSE',
            buttonTitle: '⏸️ Pause',
          }),
          expect.objectContaining({
            identifier: 'TTS_STOP',
            buttonTitle: '⏹️ Stop',
          }),
          expect.objectContaining({
            identifier: 'TTS_NEXT',
            buttonTitle: '⏭️ Next',
          }),
        ],
      );
    });
  });

  describe('showTTSNotification', () => {
    const mockData: TTSNotificationData = {
      novelName: 'Test Novel',
      chapterName: 'Chapter 1',
      isPlaying: true,
    };

    it('should show TTS notification with playing status', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await showTTSNotification(mockData);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'tts-control',
        content: {
          title: 'Test Novel',
          subtitle: 'Chapter 1',
          body: 'Playing',
          categoryIdentifier: 'TTS_CONTROLS',
          sticky: true,
          sound: false,
          priority: 'high',
        },
        trigger: { seconds: 1, channelId: 'tts-controls' },
      });
    });

    it('should show TTS notification with paused status', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      const pausedData = { ...mockData, isPlaying: false };
      await showTTSNotification(pausedData);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'tts-control',
        content: {
          title: 'Test Novel',
          subtitle: 'Chapter 1',
          body: 'Paused',
          categoryIdentifier: 'TTS_CONTROLS',
          sticky: true,
          sound: false,
          priority: 'high',
        },
        trigger: { seconds: 1, channelId: 'tts-controls' },
      });
    });

    it('should call updateTTSCategory before scheduling', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await showTTSNotification(mockData);

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'TTS_CONTROLS',
        expect.any(Array),
      );
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('updateTTSNotification', () => {
    const mockData: TTSNotificationData = {
      novelName: 'Test Novel',
      chapterName: 'Chapter 2',
      isPlaying: false,
    };

    it('should update existing TTS notification', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await updateTTSNotification(mockData);

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'tts-control',
        content: {
          title: 'Test Novel',
          subtitle: 'Chapter 2',
          body: 'Paused',
          categoryIdentifier: 'TTS_CONTROLS',
          sticky: true,
          sound: false,
          priority: 'high',
        },
        trigger: { seconds: 1, channelId: 'tts-controls' },
      });
    });

    it('should call updateTTSCategory before updating', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      await updateTTSNotification(mockData);

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'TTS_CONTROLS',
        expect.any(Array),
      );
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('dismissTTSNotification', () => {
    it('should dismiss TTS notification', async () => {
      const mockDismissNotificationAsync =
        Notifications.dismissNotificationAsync as jest.Mock;
      mockDismissNotificationAsync.mockResolvedValue(undefined);

      await dismissTTSNotification();

      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('tts-control');
    });
  });

  describe('TTS Action Management', () => {
    const { MMKVStorage } = require('@utils/mmkv/mmkv');

    beforeEach(() => {
      MMKVStorage.set.mockClear();
      MMKVStorage.getString.mockClear();
      MMKVStorage.delete.mockClear();
    });

    it('should set TTS action', () => {
      setTTSAction('PLAY');

      expect(MMKVStorage.set).toHaveBeenCalledWith(
        'TTS_NOTIFICATION_ACTION',
        'PLAY',
      );
    });

    it('should get TTS action', () => {
      MMKVStorage.getString.mockReturnValue('PAUSE');

      const result = getTTSAction();

      expect(MMKVStorage.getString).toHaveBeenCalledWith(
        'TTS_NOTIFICATION_ACTION',
      );
      expect(result).toBe('PAUSE');
    });

    it('should return undefined when no TTS action is set', () => {
      MMKVStorage.getString.mockReturnValue(undefined);

      const result = getTTSAction();

      expect(MMKVStorage.getString).toHaveBeenCalledWith(
        'TTS_NOTIFICATION_ACTION',
      );
      expect(result).toBeUndefined();
    });

    it('should clear TTS action', () => {
      clearTTSAction();

      expect(MMKVStorage.delete).toHaveBeenCalledWith(
        'TTS_NOTIFICATION_ACTION',
      );
    });
  });

  describe('Integration', () => {
    it('should handle complete notification flow', async () => {
      const mockScheduleNotificationAsync =
        Notifications.scheduleNotificationAsync as jest.Mock;
      mockScheduleNotificationAsync.mockResolvedValue('notification-id');

      const mockData: TTSNotificationData = {
        novelName: 'Integration Test Novel',
        chapterName: 'Chapter 10',
        isPlaying: true,
      };

      // Show notification
      await showTTSNotification(mockData);

      // Update notification
      const updatedData = { ...mockData, isPlaying: false };
      await updateTTSNotification(updatedData);

      // Dismiss notification
      await dismissTTSNotification();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledTimes(
        2,
      );
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
    });
  });
});
