import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import TimeTab from '../components/TimeTab';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockTheme = {
  primary: '#6750a4',
  secondary: '#625b71',
  secondaryContainer: '#e8def8',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
  surface: '#fffbfe',
  surfaceVariant: '#e7e0ec',
  outlineVariant: '#cac4d0',
  isDark: false,
};

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
  useAppSettings: () => ({ uiScale: 1 }),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: (id: string) => ({ id, name: `Plugin ${id}` }),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => {
    const map: Record<string, string> = {
      'statsScreen.totalReadingTime': 'Total reading time',
      'statsScreen.days': 'days',
      'statsScreen.hours': 'hours',
      'statsScreen.mins': 'mins',
      'statsScreen.total': 'total',
      'statsScreen.readingVelocity': 'Reading velocity',
      'statsScreen.chaptersPerHour': 'chapters / hour',
      'statsScreen.minsPerChapter': 'mins / chapter',
      'statsScreen.velocityEmpty':
        'Not enough data yet — read a few chapters to see velocity.',
      'statsScreen.topNovelsByTime': 'Top novels by time',
      'statsScreen.noTimeRecorded': 'No reading time recorded yet.',
    };
    return map[key] ?? key;
  }),
}));

describe('TimeTab — UI & Navigation Regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders fallback when reading time is under 1 minute', () => {
    render(
      <TimeTab
        stats={{ chaptersRead: 2, totalReadingTime: 30000 }} // 30s (< 60s)
        topNovels={[]}
      />,
    );
    expect(
      screen.getByText(
        'Not enough data yet — read a few chapters to see velocity.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('No reading time recorded yet.')).toBeTruthy();
  });

  it('calculates reading velocity when time is >= 1 minute', () => {
    // 2 hours = 7200000 ms, 10 chapters
    render(
      <TimeTab
        stats={{ chaptersRead: 10, totalReadingTime: 7200000 }}
        topNovels={[]}
      />,
    );
    expect(screen.getByText('5.0')).toBeTruthy(); // 10 ch / 2 hrs = 5.0 ch/h
    expect(screen.getByText('chapters / hour')).toBeTruthy();
    expect(screen.getByText('12.0')).toBeTruthy(); // 120 mins / 10 ch = 12.0 mins/ch
    expect(screen.getByText('mins / chapter')).toBeTruthy();
  });

  it('renders top novels with covers and navigates to ReaderStack Novel on press', () => {
    const topNovels = [
      {
        id: 42,
        pluginId: 'p1',
        name: 'Lord of the Mysteries',
        path: '/lotm',
        cover: 'https://example.com/cover.jpg',
        timeSpent: 3600000,
      },
    ];

    render(
      <TimeTab
        stats={{ chaptersRead: 20, totalReadingTime: 3600000 }}
        topNovels={topNovels}
      />,
    );

    expect(screen.getByText('Lord of the Mysteries')).toBeTruthy();
    expect(screen.getByText('Plugin p1')).toBeTruthy();
    expect(screen.getByText('1h')).toBeTruthy();

    // Tap novel row
    fireEvent.press(screen.getByText('Lord of the Mysteries'));
    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        id: 42,
        pluginId: 'p1',
        name: 'Lord of the Mysteries',
        cover: 'https://example.com/cover.jpg',
        path: '/lotm',
        inLibrary: true,
      },
    });
  });
});
