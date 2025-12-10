import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { Portal, TextInput } from 'react-native-paper';
import { updateNovelInfo } from '@database/queries/NovelQueries';

import { getString } from '@strings/translations';
import { Button, Modal } from '@components';
import { ThemeColors } from '@theme/types';
import { NovelInfo } from '@database/types';
import { NovelStatus } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface EditInfoModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  setNovel: (novel: NovelInfo | undefined) => void;
}

// --- Main Component ---
const EditInfoModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  setNovel,
}: EditInfoModalProps) => {
  const initialNovelInfo = { ...novel };
  const [novelInfo, setNovelInfo] = useState(novel);
  const [newGenre, setNewGenre] = useState('');
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        errorText: {
          color: '#FF0033',
          paddingTop: scaleDimension(8, uiScale),
        },
        inputWrapper: {
          fontSize: scaleDimension(14, uiScale),
          marginBottom: scaleDimension(12, uiScale),
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
        statusRow: {
          marginVertical: scaleDimension(8, uiScale),
          flexDirection: 'row',
          alignItems: 'center',
        },
        statusScrollView: {
          marginLeft: scaleDimension(8, uiScale),
        },
        statusChipContainer: {
          borderRadius: scaleDimension(8, uiScale),
          overflow: 'hidden',
        },
        statusChipPressable: {
          paddingVertical: scaleDimension(6, uiScale),
          paddingHorizontal: scaleDimension(12, uiScale),
        },
        genreList: {
          marginVertical: scaleDimension(8, uiScale),
        },
        buttonRow: {
          flexDirection: 'row',
        },
        flex1: {
          flex: 1,
        },
        genreChipContainer: {
          flex: 1,
          flexDirection: 'row',
          borderRadius: scaleDimension(8, uiScale),
          paddingVertical: scaleDimension(6, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
          marginBottom: scaleDimension(4, uiScale),
          marginRight: scaleDimension(8, uiScale),
          justifyContent: 'center',
          alignItems: 'center',
        },
        genreChipText: {
          fontSize: scaleDimension(12, uiScale),
          textTransform: 'capitalize',
        },
        genreChipIcon: {
          marginLeft: scaleDimension(4, uiScale),
        },
      }),
    [uiScale],
  );

  const removeTag = (t: string) => {
    setNovelInfo({
      ...novel,
      genres: novelInfo.genres
        ?.split(',')
        .filter(item => item !== t)
        ?.join(','),
    });
  };

  const status = Object.values(NovelStatus);

  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={hideModal}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('novelScreen.edit.info')}
        </Text>
        <View style={styles.statusRow}>
          <Text
            style={{
              color: theme.onSurfaceVariant,
              fontSize: scaleDimension(14, uiScale),
            }}
          >
            {getString('novelScreen.edit.status')}
          </Text>
          <ScrollView
            style={styles.statusScrollView}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {status.map((item, index) => (
              <View
                style={styles.statusChipContainer}
                key={'novelInfo' + index}
              >
                <Pressable
                  style={[
                    styles.statusChipPressable,
                    novelInfo.status === item && {
                      backgroundColor: theme.rippleColor,
                    },
                  ]}
                  android_ripple={{
                    color: theme.rippleColor,
                  }}
                  onPress={() => setNovelInfo({ ...novel, status: item })}
                >
                  <Text
                    style={{
                      color:
                        novelInfo.status === item
                          ? theme.primary
                          : theme.onSurfaceVariant,
                      fontSize: scaleDimension(12, uiScale),
                    }}
                  >
                    {translateNovelStatus(item)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
        <TextInput
          defaultValue={initialNovelInfo.name}
          value={novelInfo.name}
          placeholder={getString('novelScreen.edit.title', {
            title: novel.name,
          })}
          numberOfLines={1}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          onChangeText={text => setNovelInfo({ ...novel, name: text })}
          dense
          style={styles.inputWrapper}
        />
        <TextInput
          defaultValue={initialNovelInfo.author}
          value={novelInfo.author}
          placeholder={getString('novelScreen.edit.author', {
            author: novel.author,
          })}
          numberOfLines={1}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          onChangeText={text => setNovelInfo({ ...novel, author: text })}
          dense
          style={styles.inputWrapper}
        />
        <TextInput
          defaultValue={initialNovelInfo.artist}
          value={novelInfo.artist}
          placeholder={'Artist: ' + novel.artist}
          numberOfLines={1}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          onChangeText={text => setNovelInfo({ ...novel, artist: text })}
          dense
          style={styles.inputWrapper}
        />
        <TextInput
          defaultValue={initialNovelInfo.summary}
          value={novelInfo.summary}
          placeholder={getString('novelScreen.edit.summary', {
            summary: novel.summary?.substring(0, 16),
          })}
          numberOfLines={1}
          mode="outlined"
          onChangeText={text => setNovelInfo({ ...novel, summary: text })}
          theme={{ colors: { ...theme } }}
          dense
          style={styles.inputWrapper}
        />

        <TextInput
          value={newGenre}
          placeholder={getString('novelScreen.edit.addTag')}
          numberOfLines={1}
          mode="outlined"
          onChangeText={text => setNewGenre(text)}
          onSubmitEditing={() => {
            const newGenreTrimmed = newGenre.trim();

            if (newGenreTrimmed === '') {
              return;
            }

            setNovelInfo(prevVal => ({
              ...prevVal,
              genres: novelInfo.genres
                ? `${novelInfo.genres},` + newGenreTrimmed
                : newGenreTrimmed,
            }));
            setNewGenre('');
          }}
          theme={{ colors: { ...theme } }}
          dense
          style={styles.inputWrapper}
        />

        {novelInfo.genres !== undefined && novelInfo.genres !== '' ? (
          <FlatList
            style={styles.genreList}
            horizontal
            data={novelInfo.genres?.split(',')}
            keyExtractor={(_, index) => 'novelTag' + index}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.genreChipContainer,
                  { backgroundColor: theme.secondaryContainer },
                ]}
              >
                <Text
                  style={[
                    styles.genreChipText,
                    { color: theme.onSecondaryContainer },
                  ]}
                >
                  {item}
                </Text>
                <MaterialCommunityIcons
                  name="close"
                  size={scaleDimension(18, uiScale)}
                  onPress={() => removeTag(item)}
                  style={styles.genreChipIcon}
                  color={theme.onSecondaryContainer}
                />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        ) : null}
        <View style={styles.buttonRow}>
          <Button
            onPress={() => {
              setNovelInfo(initialNovelInfo);
              updateNovelInfo(initialNovelInfo);
            }}
          >
            {getString('common.reset')}
          </Button>
          <View style={styles.flex1} />
          <Button
            onPress={() => {
              setNovel(novelInfo);
              updateNovelInfo(novelInfo);
              hideModal();
            }}
          >
            {getString('common.save')}
          </Button>
          <Button onPress={hideModal}>{getString('common.cancel')}</Button>
        </View>
      </Modal>
    </Portal>
  );
};

export default EditInfoModal;
