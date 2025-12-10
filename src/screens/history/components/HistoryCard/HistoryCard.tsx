import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';

import { IconButtonV2 } from '@components';

import { defaultCover } from '@plugins/helpers/constants';
import { getString } from '@strings/translations';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { History, NovelInfo } from '@database/types';
import { HistoryScreenProps } from '@navigators/types';

import { coverPlaceholderColor } from '@theme/colors';

interface HistoryCardProps {
  history: History;
  handleRemoveFromHistory: (chapterId: number) => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({
  history,
  handleRemoveFromHistory,
}) => {
  const theme = useTheme();
  const { navigate } = useNavigation<HistoryScreenProps['navigation']>();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        buttonContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(8, uiScale),
        },
        cover: {
          backgroundColor: coverPlaceholderColor,
          borderRadius: scaleDimension(4, uiScale),
          height: scaleDimension(80, uiScale),
          width: scaleDimension(56, uiScale),
        },
        detailsContainer: {
          flex: 1,
          justifyContent: 'center',
          marginLeft: scaleDimension(16, uiScale),
        },
        imageAndNameContainer: {
          alignItems: 'center',
          flex: 1,
          flexDirection: 'row',
        },
        novelName: {
          marginBottom: scaleDimension(4, uiScale),
          fontWeight: '500',
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      style={styles.container}
      android_ripple={{ color: theme.rippleColor }}
      onPress={() =>
        navigate('ReaderStack', {
          screen: 'Chapter',
          params: {
            novel: {
              path: history.novelPath,
              name: history.novelName,
              pluginId: history.pluginId,
            } as NovelInfo,
            chapter: history,
          },
        })
      }
    >
      <View style={styles.imageAndNameContainer}>
        <Pressable
          onPress={() =>
            navigate('ReaderStack', {
              screen: 'Novel',
              params: {
                name: history.name,
                path: history.novelPath,
                cover: history.novelCover,
                pluginId: history.pluginId,
              },
            })
          }
        >
          <Image
            source={{ uri: history.novelCover || defaultCover }}
            style={styles.cover}
          />
        </Pressable>
        <View style={styles.detailsContainer}>
          <Text
            numberOfLines={2}
            style={[
              {
                color: theme.onSurface,
                fontSize: scaleDimension(14, uiScale),
              },
              styles.novelName,
            ]}
          >
            {history.novelName}
          </Text>
          <Text
            style={{
              color: theme.onSurfaceVariant,
              fontSize: scaleDimension(12, uiScale),
              marginTop: scaleDimension(4, uiScale),
            }}
          >
            {`${getString('historyScreen.chapter')} ${
              history.chapterNumber
            } • ${dayjs(history.readTime).format('LT').toUpperCase()}` +
              `${
                history.progress && history.progress > 0
                  ? ' • ' + history.progress + '%'
                  : ''
              }`}
          </Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <IconButtonV2
          name="delete-outline"
          theme={theme}
          onPress={() => handleRemoveFromHistory(history.id)}
        />
      </View>
    </Pressable>
  );
};

export default HistoryCard;
