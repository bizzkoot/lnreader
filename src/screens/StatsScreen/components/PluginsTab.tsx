import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { NovelWithGenresRow } from '@database/queries/StatsQueries';
import { getPlugin } from '@plugins/pluginManager';
import DistributionBar from './DistributionBar';
import { getDonutPalette } from '../utils';
import { getString } from '@strings/translations';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '@navigators/types';

interface Props {
  novels: NovelWithGenresRow[];
}

const PluginsTab: React.FC<Props> = ({ novels }) => {
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  const grouped = useMemo(() => {
    const map = new Map<string, NovelWithGenresRow[]>();
    novels.forEach(n => {
      const key = n.pluginId ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return Array.from(map.entries())
      .map(([pluginId, list]) => ({
        pluginId,
        name: getPlugin(pluginId)?.name ?? pluginId,
        count: list.length,
        novels: list,
      }))
      .sort((a, b) => b.count - a.count);
  }, [novels]);

  const entries = grouped.map(g => ({
    key: g.pluginId,
    value: g.count,
    label: g.name,
  }));
  const palette = useMemo(
    () =>
      getDonutPalette(
        entries.map(e => e.key),
        theme,
      ),
    [entries, theme],
  );

  if (!grouped.length) {
    return (
      <View style={styles.empty}>
        <AppText style={{ color: theme.onSurfaceVariant }}>
          {getString('statsScreen.noPluginsInLibrary')}
        </AppText>
      </View>
    );
  }

  const pluginsTitle = getString('statsScreen.tabs.plugins') || 'Plugins';
  const titlesLabel =
    getString('statsScreen.titlesInLibrary') || 'Titles in library';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText style={[styles.header, { color: theme.onSurfaceVariant }]}>
        {pluginsTitle} · {novels.length} {titlesLabel.toLowerCase()}
      </AppText>
      <DistributionBar entries={entries} colors={palette} />

      <View style={styles.sections}>
        {grouped.map(group => {
          const maxChapters = Math.max(
            ...group.novels.map(n => n.totalChapters),
            1,
          );
          return (
            <View
              key={group.pluginId}
              style={[styles.section, { borderColor: theme.outlineVariant }]}
            >
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: palette[group.pluginId] ?? theme.primary,
                    },
                  ]}
                />
                <AppText
                  style={[styles.sectionTitle, { color: theme.onSurface }]}
                  numberOfLines={1}
                >
                  {group.name}
                </AppText>
                <AppText
                  style={[
                    styles.sectionCount,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {group.count}
                </AppText>
              </View>
              <View style={styles.novelList}>
                {group.novels.slice(0, 8).map(n => (
                  <Pressable
                    key={n.id}
                    onPress={() =>
                      navigate('ReaderStack', {
                        screen: 'Novel',
                        params: {
                          id: n.id,
                          pluginId: n.pluginId,
                          name: n.name,
                          cover: n.cover ?? undefined,
                          path: n.path,
                          inLibrary: true,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.novelRow,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <AppText
                      style={[styles.novelName, { color: theme.onSurface }]}
                      numberOfLines={1}
                    >
                      {n.name}
                    </AppText>
                    <View style={styles.miniTrack}>
                      <View
                        style={[
                          styles.miniFill,
                          {
                            width: `${(n.totalChapters / maxChapters) * 100}%`,
                            backgroundColor:
                              palette[group.pluginId] ?? theme.primary,
                          },
                        ]}
                      />
                    </View>
                    <AppText
                      style={[
                        styles.novelChapters,
                        { color: theme.onSurfaceVariant },
                      ]}
                    >
                      {n.totalChapters}
                    </AppText>
                  </Pressable>
                ))}
                {group.novels.length > 8 ? (
                  <AppText
                    style={[styles.more, { color: theme.onSurfaceVariant }]}
                  >
                    {getString('statsScreen.moreNovels', {
                      count: group.novels.length - 8,
                    })}
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
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
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    sections: { gap: 16, marginTop: 8 },
    section: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    sectionTitle: {
      flex: 1,
      fontSize: scaleDimension(13, uiScale),
      fontWeight: '600',
    },
    sectionCount: { fontSize: scaleDimension(12, uiScale) },
    novelList: { gap: 6 },
    novelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    novelName: { flex: 1, fontSize: scaleDimension(11, uiScale) },
    miniTrack: {
      width: 48,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.08)',
      overflow: 'hidden',
    },
    miniFill: { height: '100%', borderRadius: 3 },
    novelChapters: {
      fontSize: scaleDimension(10, uiScale),
      minWidth: 28,
      textAlign: 'right',
    },
    more: {
      fontSize: scaleDimension(11, uiScale),
      textAlign: 'center',
      marginTop: 4,
    },
  });

export default PluginsTab;
