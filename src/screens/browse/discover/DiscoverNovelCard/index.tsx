import React from 'react';
import { Pressable, StyleSheet, View, Image } from 'react-native';

import { ThemeColors } from '@theme/types';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

interface Props {
  novel: {
    novelName: string;
    novelCover: string;
    score: string;
    info: string[];
  };
  onPress: () => void;
  theme: ThemeColors;
  uiScale?: number;
}

const DiscoverNovelCard: React.FC<Props> = ({
  novel,
  onPress,
  theme,
  uiScale = 1.0,
}) => {
  return (
    <View style={[styles.container, { backgroundColor: theme.overlay3 }]}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        android_ripple={{ color: theme.rippleColor }}
      >
        <Image
          source={{ uri: novel.novelCover }}
          style={getCoverStyle(uiScale)}
        />
        <View style={styles.infoContainer}>
          <AppText
            style={[getTitleStyle(uiScale), { color: theme.onSurface }]}
            numberOfLines={2}
          >
            {novel.novelName}
          </AppText>
          <AppText style={[getSmallStyle(uiScale), { color: theme.onSurface }]}>
            Score:{' '}
            <AppText style={{ color: theme.onSurfaceVariant }}>
              {novel.score}
            </AppText>
          </AppText>
          {novel?.info?.[1] ? (
            <AppText
              style={[getSmallStyle(uiScale), { color: theme.onSurface }]}
            >
              Type:{' '}
              <AppText style={{ color: theme.onSurfaceVariant }}>
                {novel.info[1]}
              </AppText>
            </AppText>
          ) : null}
          {novel?.info?.[2] ? (
            <AppText
              style={[getSmallStyle(uiScale), { color: theme.onSurface }]}
            >
              Published:{' '}
              <AppText style={{ color: theme.onSurfaceVariant }}>
                {novel.info[2]}
              </AppText>
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
};

export default DiscoverNovelCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    flex: 1,
    margin: 8,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
  },
});

const getCoverStyle = (uiScale: number) => ({
  borderBottomLeftRadius: 8,
  borderTopLeftRadius: 8,
  width: scaleDimension(100, uiScale),
});

const getSmallStyle = (uiScale: number) => ({
  fontSize: scaleDimension(12, uiScale),
  marginVertical: 4,
});

const getTitleStyle = (uiScale: number) => ({
  fontSize: scaleDimension(16, uiScale),
  marginBottom: 4,
});
