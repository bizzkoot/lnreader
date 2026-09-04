import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import StatsScreen from '../StatsScreen';

let focusCb: (() => void) | null = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: jest.fn((cb: () => void) => {
    focusCb = cb;
  }),
}));

jest.mock('@database/queries/StatsQueries', () => ({
  getAggregateStatsFromDb: jest.fn(),
  getNovelsWithGenresFromDb: jest.fn(),
  getTopNovelsByReadingTimeFromDb: jest.fn(),
  splitCsvField: jest.fn((v: string) => (v ? v.split(',') : [])),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    primary: '#6750a4',
    surface: '#fff',
    rippleColor: '#ccc',
    secondary: '#666',
    onSurfaceVariant: '#444',
  }),
  useAppSettings: () => ({ uiScale: 1 }),
}));

jest.mock('@strings/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@components', () => {
  const { View, Text } = require('react-native');
  return {
    Appbar: () => null,
    ErrorScreenV2: () => null,
    LoadingScreenV2: () => <Text>STATS_LOADING</Text>,
    SafeAreaView: ({ children }: any) => <View>{children}</View>,
    TopTabBar: () => null,
  };
});

jest.mock('react-native-tab-view', () => ({
  TabView: ({ navigationState, renderScene }: any) =>
    renderScene({ route: navigationState.routes[navigationState.index] }),
}));

jest.mock('../components/OverviewTab', () => {
  const { Text } = require('react-native');
  return ({ stats }: any) => (
    <Text>OVERVIEW:{stats.totalReadingTime ?? 'none'}</Text>
  );
});
jest.mock('../components/PluginsTab', () => () => null);
jest.mock('../components/TimeTab', () => {
  const { Text } = require('react-native');
  return ({ stats }: any) => (
    <Text>TIME:{stats.totalReadingTime ?? 'none'}</Text>
  );
});

const {
  getAggregateStatsFromDb,
  getNovelsWithGenresFromDb,
  getTopNovelsByReadingTimeFromDb,
} = require('@database/queries/StatsQueries');

const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('StatsScreen — focus refetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    focusCb = null;
    (getAggregateStatsFromDb as jest.Mock).mockResolvedValue({
      totalReadingTime: 1000,
    });
    (getNovelsWithGenresFromDb as jest.Mock).mockResolvedValue([]);
    (getTopNovelsByReadingTimeFromDb as jest.Mock).mockResolvedValue([]);
  });

  it('loads on focus and silently refreshes on refocus (no loader flash)', async () => {
    render(<StatsScreen />);
    expect(focusCb).not.toBeNull();

    // First focus: full-screen loader, then data
    act(() => {
      focusCb!();
    });
    expect(screen.getByText('STATS_LOADING')).toBeTruthy();
    await flush();
    await flush();
    expect(screen.getByText('OVERVIEW:1000')).toBeTruthy();
    expect(screen.queryByText('STATS_LOADING')).toBeNull();
    expect(getAggregateStatsFromDb).toHaveBeenCalledTimes(1);

    // New session recorded elsewhere → refocus picks it up silently
    (getAggregateStatsFromDb as jest.Mock).mockResolvedValue({
      totalReadingTime: 5000,
    });
    act(() => {
      focusCb!();
    });
    expect(screen.queryByText('STATS_LOADING')).toBeNull();
    await flush();
    await flush();
    expect(getAggregateStatsFromDb).toHaveBeenCalledTimes(2);
    expect(screen.getByText('OVERVIEW:5000')).toBeTruthy();
    expect(screen.queryByText('STATS_LOADING')).toBeNull();
  });
});
