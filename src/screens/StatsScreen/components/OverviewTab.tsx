import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { LibraryStats } from '@database/types';
import { NovelWithGenresRow } from '@database/queries/StatsQueries';
import { getString } from '@strings/translations';
import { translateNovelStatus } from '@utils/translateEnum';
import { StatsCard } from '../StatsScreen';
import ChapterBar from './ChapterBar';
import DistributionBar from './DistributionBar';
import GenreSection from './GenreSection';
import { buildGenreTree, getDonutPalette } from '../utils';
import { GENRE_TAXONOMY } from '../taxonomy';

interface Props {
  stats: LibraryStats & { totalReadingTime?: number };
  novels: NovelWithGenresRow[];
}

const OverviewTab: React.FC<Props> = ({ stats, novels }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  const genreTree = useMemo(
    () => buildGenreTree(novels, GENRE_TAXONOMY),
    [novels],
  );

  const statusEntries = useMemo(() => {
    const entries = Object.entries(stats.status ?? {})
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => ({
        key: k,
        value: v as number,
        label: translateNovelStatus(k),
      }));
    return entries.sort((a, b) => b.value - a.value);
  }, [stats.status]);

  const genreEntries = useMemo(() => {
    const e = Object.entries(stats.genres ?? {}).map(([k, v]) => ({
      key: k,
      value: v as number,
    }));
    return e.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [stats.genres]);

  const statusPalette = useMemo(
    () =>
      getDonutPalette(
        statusEntries.map(e => e.key),
        theme,
      ),
    [statusEntries, theme],
  );
  const genrePalette = useMemo(
    () =>
      getDonutPalette(
        genreEntries.map(e => e.key),
        theme,
      ),
    [genreEntries, theme],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('generalSettings')}
      </AppText>
      <View style={styles.cardsRow}>
        <StatsCard
          label={getString('statsScreen.titlesInLibrary')}
          value={stats.novelsCount}
        />
        <StatsCard
          label={getString('statsScreen.readChapters')}
          value={stats.chaptersRead}
        />
        <StatsCard
          label={getString('statsScreen.totalChapters')}
          value={stats.chaptersCount}
        />
      </View>
      <View style={styles.cardsRow}>
        <StatsCard
          label={getString('statsScreen.unreadChapters')}
          value={stats.chaptersUnread}
        />
        <StatsCard
          label={getString('statsScreen.downloadedChapters')}
          value={stats.chaptersDownloaded}
        />
        <StatsCard
          label={getString('statsScreen.sources')}
          value={stats.sourcesCount}
        />
      </View>

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        Chapters
      </AppText>
      <ChapterBar
        chaptersCount={stats.chaptersCount ?? 0}
        chaptersRead={stats.chaptersRead ?? 0}
        chaptersDownloaded={stats.chaptersDownloaded ?? 0}
      />

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('statsScreen.statusDistribution')}
      </AppText>
      <DistributionBar entries={statusEntries} colors={statusPalette} />

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('statsScreen.genreDistribution')}
      </AppText>
      <DistributionBar entries={genreEntries} colors={genrePalette} />

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        Genre exploration
      </AppText>
      <GenreSection tree={genreTree} />
    </ScrollView>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    header: {
      fontWeight: 'bold',
      paddingVertical: 16,
      fontSize: scaleDimension(13, uiScale),
    },
    cardsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 8,
      gap: 4,
    },
  });

export default OverviewTab;
