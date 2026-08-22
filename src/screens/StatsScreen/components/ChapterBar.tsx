import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { getString } from '@strings/translations';

interface Props {
  chaptersCount: number;
  chaptersRead: number;
  chaptersDownloaded: number;
}

const ChapterBar: React.FC<Props> = ({
  chaptersCount,
  chaptersRead,
  chaptersDownloaded,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  const total = Math.max(1, chaptersCount);
  const readPct = Math.min(1, chaptersRead / total);
  const dlPct = Math.min(1, chaptersDownloaded / total);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: theme.surfaceVariant }]}>
        <View
          style={[
            styles.fill,
            { width: `${readPct * 100}%`, backgroundColor: theme.primary },
          ]}
        />
      </View>
      <View style={styles.labels}>
        <AppText style={[styles.label, { color: theme.onSurfaceVariant }]}>
          {getString('statsScreen.readChapters')}: {chaptersRead}/
          {chaptersCount}
        </AppText>
        <AppText style={[styles.label, { color: theme.onSurfaceVariant }]}>
          {getString('statsScreen.downloadedChapters')}: {chaptersDownloaded}
        </AppText>
      </View>
      <View
        style={[
          styles.track,
          { backgroundColor: theme.surfaceVariant, marginTop: 8 },
        ]}
      >
        <View
          style={[
            styles.fill,
            { width: `${dlPct * 100}%`, backgroundColor: theme.secondary },
          ]}
        />
      </View>
      <AppText style={[styles.subLabel, { color: theme.onSurfaceVariant }]}>
        {Math.round(dlPct * 100)}% downloaded
      </AppText>
    </View>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    container: { paddingVertical: 8 },
    track: {
      height: scaleDimension(10, uiScale),
      borderRadius: scaleDimension(6, uiScale),
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 6 },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    label: { fontSize: scaleDimension(12, uiScale) },
    subLabel: { fontSize: scaleDimension(11, uiScale), marginTop: 4 },
  });

export default ChapterBar;
