import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { LibraryStats } from '@database/types';
import { TopNovelTimeRow } from '@database/queries/StatsQueries';
import { formatTimeSpent, formatTotalTimeParts } from '../utils';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '@navigators/types';
import { defaultCover } from '@plugins/helpers/constants';

interface Props {
  stats: LibraryStats & { totalReadingTime?: number };
  topNovels: TopNovelTimeRow[];
}

const TimeTab: React.FC<Props> = ({ stats, topNovels }) => {
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);
  const totalMs = stats.totalReadingTime ?? 0;
  const parts = formatTotalTimeParts(totalMs);

  // AUD-STAT-02: Do not divide lifetime chaptersRead (pre-migration) by post-migration totalMs.
  // Velocity is meaningful only when reading-time sample is sufficient; otherwise show empty state.
  const velocity = useMemo(() => {
    const chaptersRead = stats.chaptersRead ?? 0;
    if (totalMs < 60000 || !chaptersRead) return null;
    const hours = totalMs / 3600000;
    const cph = hours ? chaptersRead / hours : 0;
    const minsPerChapter = chaptersRead ? totalMs / 60000 / chaptersRead : 0;
    // Guard against distortion: lifetime counts (e.g. 1000) / small session time (5m) -> absurd cph
    // Heuristic thresholds: >50 ch/h or <0.5 min/ch is implausible for light novels
    if (!Number.isFinite(cph) || !Number.isFinite(minsPerChapter)) return null;
    if (cph > 50 || minsPerChapter < 0.5) return null;
    return { cph, minsPerChapter };
  }, [stats.chaptersRead, totalMs]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('statsScreen.totalReadingTime')}
      </AppText>
      <View style={styles.timeRow}>
        <View
          style={[
            styles.timeBox,
            { backgroundColor: theme.secondaryContainer },
          ]}
        >
          <AppText style={[styles.timeVal, { color: theme.primary }]}>
            {parts.days}
          </AppText>
          <AppText style={{ color: theme.onSurfaceVariant }}>
            {getString('statsScreen.days')}
          </AppText>
        </View>
        <View
          style={[
            styles.timeBox,
            { backgroundColor: theme.secondaryContainer },
          ]}
        >
          <AppText style={[styles.timeVal, { color: theme.primary }]}>
            {parts.hours}
          </AppText>
          <AppText style={{ color: theme.onSurfaceVariant }}>
            {getString('statsScreen.hours')}
          </AppText>
        </View>
        <View
          style={[
            styles.timeBox,
            { backgroundColor: theme.secondaryContainer },
          ]}
        >
          <AppText style={[styles.timeVal, { color: theme.primary }]}>
            {parts.minutes}
          </AppText>
          <AppText style={{ color: theme.onSurfaceVariant }}>
            {getString('statsScreen.mins')}
          </AppText>
        </View>
      </View>
      <AppText style={[styles.sub, { color: theme.onSurfaceVariant }]}>
        {formatTimeSpent(totalMs)} {getString('statsScreen.total')}
      </AppText>

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('statsScreen.readingVelocity')}
      </AppText>
      {velocity ? (
        <View style={styles.velocityRow}>
          <View
            style={[
              styles.velocityBox,
              { backgroundColor: theme.surfaceVariant },
            ]}
          >
            <AppText style={[styles.velocityVal, { color: theme.primary }]}>
              {velocity.cph.toFixed(1)}
            </AppText>
            <AppText
              style={[styles.velocityLabel, { color: theme.onSurfaceVariant }]}
            >
              {getString('statsScreen.chaptersPerHour')}
            </AppText>
          </View>
          <View
            style={[
              styles.velocityBox,
              { backgroundColor: theme.surfaceVariant },
            ]}
          >
            <AppText style={[styles.velocityVal, { color: theme.primary }]}>
              {velocity.minsPerChapter.toFixed(1)}
            </AppText>
            <AppText
              style={[styles.velocityLabel, { color: theme.onSurfaceVariant }]}
            >
              {getString('statsScreen.minsPerChapter')}
            </AppText>
          </View>
        </View>
      ) : (
        <AppText style={{ color: theme.onSurfaceVariant, paddingVertical: 8 }}>
          {getString('statsScreen.velocityEmpty')}
        </AppText>
      )}

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {getString('statsScreen.topNovelsByTime')}
      </AppText>
      {topNovels.length === 0 ? (
        <AppText style={{ color: theme.onSurfaceVariant, paddingVertical: 8 }}>
          {getString('statsScreen.noTimeRecorded')}
        </AppText>
      ) : (
        <View style={styles.list}>
          {topNovels.map(row => {
            const pluginName = getPlugin(row.pluginId)?.name ?? row.pluginId;
            return (
              <Pressable
                key={row.id}
                onPress={() =>
                  navigate('ReaderStack', {
                    screen: 'Novel',
                    params: {
                      id: row.id,
                      pluginId: row.pluginId,
                      name: row.name,
                      cover: row.cover ?? undefined,
                      path: row.path,
                      inLibrary: true,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.novelRow,
                  {
                    borderColor: theme.outlineVariant,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Image
                  source={{ uri: row.cover || defaultCover }}
                  style={styles.novelCover}
                />
                <View style={styles.novelInfo}>
                  <AppText
                    style={[styles.novelName, { color: theme.onSurface }]}
                    numberOfLines={1}
                  >
                    {row.name}
                  </AppText>
                  <AppText
                    style={[
                      styles.novelMeta,
                      { color: theme.onSurfaceVariant },
                    ]}
                    numberOfLines={1}
                  >
                    {pluginName}
                  </AppText>
                </View>
                <AppText style={[styles.time, { color: theme.primary }]}>
                  {formatTimeSpent(row.timeSpent)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
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
    sub: {
      fontSize: scaleDimension(12, uiScale),
      marginTop: 8,
      textAlign: 'center',
    },
    timeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
    timeBox: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 14,
    },
    timeVal: { fontSize: scaleDimension(22, uiScale), fontWeight: 'bold' },
    velocityRow: { flexDirection: 'row', gap: 8 },
    velocityBox: {
      flex: 1,
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 12,
    },
    velocityVal: { fontSize: scaleDimension(18, uiScale), fontWeight: 'bold' },
    velocityLabel: { fontSize: scaleDimension(11, uiScale), marginTop: 2 },
    list: { gap: 8 },
    novelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 12,
    },
    novelCover: {
      width: scaleDimension(36, uiScale),
      height: scaleDimension(50, uiScale),
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    novelInfo: { flex: 1 },
    novelName: { fontSize: scaleDimension(13, uiScale), fontWeight: '600' },
    novelMeta: { fontSize: scaleDimension(11, uiScale), marginTop: 2 },
    time: { fontSize: scaleDimension(13, uiScale), fontWeight: 'bold' },
  });

export default TimeTab;
