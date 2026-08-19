import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SceneRendererProps,
  TabView,
  NavigationState,
} from 'react-native-tab-view';

import { useTheme, useAppSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import {
  Appbar,
  ErrorScreenV2,
  LoadingScreenV2,
  SafeAreaView,
  TopTabBar,
} from '@components';
import { LibraryStats } from '@database/types';
import {
  AggregateStats,
  getAggregateStatsFromDb,
  getNovelsWithGenresFromDb,
  getTopNovelsByReadingTimeFromDb,
  NovelWithGenresRow,
  TopNovelTimeRow,
} from '@database/queries/StatsQueries';
import { countBy } from 'lodash-es';
import { overlay } from 'react-native-paper';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

import OverviewTab from './components/OverviewTab';
import TimeTab from './components/TimeTab';
import PluginsTab from './components/PluginsTab';

type Route = { key: string; title: string };

const StatsScreen = () => {
  const theme = useTheme();
  const { goBack } = useNavigation();
  const { uiScale = 1.0 } = useAppSettings();
  const layout = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);

  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<AggregateStats & LibraryStats>({});
  const [novels, setNovels] = useState<NovelWithGenresRow[]>([]);
  const [topNovels, setTopNovels] = useState<TopNovelTimeRow[]>([]);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [agg, novelsWithGenres, top] = await Promise.all([
        getAggregateStatsFromDb(),
        getNovelsWithGenresFromDb(),
        getTopNovelsByReadingTimeFromDb(10),
      ]);

      const genres: string[] = [];
      const status: string[] = [];
      novelsWithGenres.forEach(n => {
        if (n.genres) {
          const parts = n.genres.split(/\s*,\s*/).filter(Boolean);
          genres.push(...parts);
        }
        if (n.status) {
          const parts = n.status.split(/\s*,\s*/).filter(Boolean);
          status.push(...parts);
        }
      });

      const merged: AggregateStats & LibraryStats = {
        ...agg,
        genres: countBy(genres),
        status: countBy(status),
      };
      setStats(merged);
      setNovels(novelsWithGenres);
      setTopNovels(top);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const routes: Route[] = useMemo(
    () => [
      {
        key: 'overview',
        title: getString('statsScreen.tabs.overview') || 'Overview',
      },
      { key: 'time', title: getString('statsScreen.tabs.time') || 'Time' },
      {
        key: 'plugins',
        title: getString('statsScreen.tabs.plugins') || 'Plugins',
      },
    ],
    [],
  );

  const renderScene = useCallback(
    ({ route }: { route: Route }) => {
      switch (route.key) {
        case 'overview':
          return <OverviewTab stats={stats} novels={novels} />;
        case 'time':
          return <TimeTab stats={stats} topNovels={topNovels} />;
        case 'plugins':
          return <PluginsTab novels={novels} />;
        default:
          return null;
      }
    },
    [stats, novels, topNovels],
  );

  const renderTabBar = useCallback(
    (
      props: SceneRendererProps & { navigationState: NavigationState<Route> },
    ) => (
      <TopTabBar
        {...props}
        scrollEnabled={false}
        indicatorStyle={{ backgroundColor: theme.primary, height: 3 }}
        style={{ backgroundColor: theme.surface, elevation: 0 }}
        activeColor={theme.primary}
        inactiveColor={theme.secondary}
        android_ripple={{ color: theme.rippleColor }}
      />
    ),
    [theme.primary, theme.rippleColor, theme.secondary, theme.surface],
  );

  const Header = (
    <Appbar
      title={getString('statsScreen.title')}
      handleGoBack={goBack}
      theme={theme}
    />
  );

  if (error) {
    return (
      <>
        {Header}
        <ErrorScreenV2 error={error} />
      </>
    );
  }
  if (isLoading) {
    return (
      <>
        {Header}
        <LoadingScreenV2 theme={theme} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {Header}
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        lazy
        commonOptions={{ labelStyle: { textTransform: 'capitalize' } as any }}
      />
    </SafeAreaView>
  );
};

export default StatsScreen;

export const StatsCard: React.FC<{ label: string; value?: number }> = ({
  label,
  value = 0,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  if (!label) return null;
  return (
    <View
      style={[
        styles.statsCardCtn,
        {
          backgroundColor: theme.isDark
            ? overlay(2, theme.surface)
            : theme.secondaryContainer,
        },
      ]}
    >
      <AppText style={[styles.statsVal, { color: theme.primary }]}>
        {value}
      </AppText>
      <AppText style={{ color: theme.onSurface }}>{label}</AppText>
    </View>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    safe: { flex: 1 },
    contentCtn: { paddingBottom: 40 },
    genreRow: { flexWrap: 'wrap' },
    header: { fontWeight: 'bold', paddingVertical: 16 },
    screenCtn: { paddingHorizontal: 16 },
    statsCardCtn: {
      alignItems: 'center',
      borderRadius: 12,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      justifyContent: 'center',
      margin: 4,
      paddingHorizontal: 8,
      paddingVertical: 12,
      minWidth: 92,
    },
    statsRow: { justifyContent: 'center', marginBottom: 8 },
    statsVal: { fontSize: scaleDimension(16, uiScale), fontWeight: 'bold' },
  });
