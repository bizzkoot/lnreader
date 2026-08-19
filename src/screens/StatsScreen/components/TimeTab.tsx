import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { LibraryStats } from '@database/types';
import { TopNovelTimeRow } from '@database/queries/StatsQueries';
import { formatTimeSpent, formatTotalTimeParts } from '../utils';
import { getPlugin } from '@plugins/pluginManager';

interface Props {
  stats: LibraryStats & { totalReadingTime?: number };
  topNovels: TopNovelTimeRow[];
}

const TimeTab: React.FC<Props> = ({ stats, topNovels }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);
  const totalMs = stats.totalReadingTime ?? 0;
  const parts = formatTotalTimeParts(totalMs);

  const velocity = useMemo(() => {
    const chaptersRead = stats.chaptersRead ?? 0;
    if (!totalMs || !chaptersRead) return null;
    const hours = totalMs / 3600000;
    const cph = hours ? chaptersRead / hours : 0;
    const minsPerChapter = chaptersRead ? totalMs / 60000 / chaptersRead : 0;
    return { cph, minsPerChapter };
  }, [stats.chaptersRead, totalMs]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        Total reading time
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
          <AppText style={{ color: theme.onSurfaceVariant }}>days</AppText>
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
          <AppText style={{ color: theme.onSurfaceVariant }}>hours</AppText>
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
          <AppText style={{ color: theme.onSurfaceVariant }}>mins</AppText>
        </View>
      </View>
      <AppText style={[styles.sub, { color: theme.onSurfaceVariant }]}>
        {formatTimeSpent(totalMs)} total
      </AppText>

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        Reading velocity
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
              chapters / hour
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
              mins / chapter
            </AppText>
          </View>
        </View>
      ) : (
        <AppText style={{ color: theme.onSurfaceVariant, paddingVertical: 8 }}>
          Not enough data yet — read a few chapters to see velocity.
        </AppText>
      )}

      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        Top novels by time
      </AppText>
      {topNovels.length === 0 ? (
        <AppText style={{ color: theme.onSurfaceVariant, paddingVertical: 8 }}>
          No reading time recorded yet.
        </AppText>
      ) : (
        <View style={styles.list}>
          {topNovels.map(row => {
            const pluginName = getPlugin(row.pluginId)?.name ?? row.pluginId;
            return (
              <View
                key={row.id}
                style={[styles.novelRow, { borderColor: theme.outlineVariant }]}
              >
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
              </View>
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
    novelInfo: { flex: 1 },
    novelName: { fontSize: scaleDimension(13, uiScale), fontWeight: '600' },
    novelMeta: { fontSize: scaleDimension(11, uiScale), marginTop: 2 },
    time: { fontSize: scaleDimension(13, uiScale), fontWeight: 'bold' },
  });

export default TimeTab;
