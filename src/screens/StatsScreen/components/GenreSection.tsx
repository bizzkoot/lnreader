import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { GenreTreeNode } from '../utils';

interface Props {
  tree: GenreTreeNode[];
}

const GenreSection: React.FC<Props> = ({ tree }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  const max = tree.reduce((m, n) => (n.count > m ? n.count : m), 1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (genre: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  };

  if (!tree.length) {
    return (
      <AppText
        style={{
          color: theme.onSurfaceVariant,
          textAlign: 'center',
          padding: 16,
        }}
      >
        No genres
      </AppText>
    );
  }

  return (
    <View style={styles.container}>
      {tree.map(node => {
        const widthPct = (node.count / max) * 100;
        const isExpanded = expanded.has(node.genre);
        const hasChildren = !!node.children?.length;
        return (
          <View key={node.genre} style={styles.rowWrap}>
            <Pressable
              onPress={() => hasChildren && toggle(node.genre)}
              disabled={!hasChildren}
              style={styles.row}
            >
              <View style={styles.labelRow}>
                <AppText
                  style={[styles.genreLabel, { color: theme.onSurface }]}
                  numberOfLines={1}
                >
                  {node.displayName}
                </AppText>
                {hasChildren ? (
                  <AppText
                    style={[
                      styles.expandHint,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    {isExpanded ? '▾' : '▸'} {node.children!.length}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${widthPct}%`, backgroundColor: theme.primary },
                  ]}
                />
              </View>
              <AppText
                style={[styles.count, { color: theme.onSurfaceVariant }]}
              >
                {node.count}
              </AppText>
            </Pressable>
            {isExpanded && hasChildren ? (
              <View style={styles.children}>
                {node.children!.map(child => {
                  const cw = (child.count / max) * 100;
                  return (
                    <View key={child.genre} style={styles.childRow}>
                      <AppText
                        style={[
                          styles.childLabel,
                          { color: theme.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        {child.displayName}
                      </AppText>
                      <View style={styles.childTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${cw}%`,
                              backgroundColor: theme.secondary,
                            },
                          ]}
                        />
                      </View>
                      <AppText
                        style={[
                          styles.childCount,
                          { color: theme.onSurfaceVariant },
                        ]}
                      >
                        {child.count}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    container: { gap: 10, paddingVertical: 8 },
    rowWrap: { gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: 130,
    },
    genreLabel: {
      fontSize: scaleDimension(13, uiScale),
      flex: 1,
      fontWeight: '500',
    },
    expandHint: { fontSize: scaleDimension(11, uiScale) },
    barTrack: {
      flex: 1,
      height: scaleDimension(8, uiScale),
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.08)',
      overflow: 'hidden',
    },
    childTrack: {
      flex: 1,
      height: scaleDimension(6, uiScale),
      borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 4 },
    count: {
      fontSize: scaleDimension(12, uiScale),
      minWidth: 28,
      textAlign: 'right',
    },
    children: { paddingLeft: 12, gap: 6, marginTop: 2 },
    childRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    childLabel: { fontSize: scaleDimension(11, uiScale), width: 118 },
    childCount: {
      fontSize: scaleDimension(11, uiScale),
      minWidth: 24,
      textAlign: 'right',
    },
  });

export default GenreSection;
