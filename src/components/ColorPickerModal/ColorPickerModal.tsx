import React, { useState, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Portal, TextInput } from 'react-native-paper';
import { Modal } from '@components';
import { ThemeColors } from '../../theme/types';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface ColorPickerModalProps {
  visible: boolean;
  title: string;
  color: string;
  onSubmit: (val: string) => void;
  closeModal: () => void;
  theme: ThemeColors;
  showAccentColors?: boolean;
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  theme,
  color,
  title,
  onSubmit,
  closeModal,
  visible,
  showAccentColors,
}) => {
  const { uiScale = 1.0 } = useAppSettings();
  const [text, setText] = useState<string>(color);
  const [error, setError] = useState<string | null>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        errorText: {
          color: '#FF0033',
          paddingTop: scaleDimension(8, uiScale),
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
        item: {
          borderRadius: scaleDimension(4, uiScale),
          overflow: 'hidden',
          flex: 1 / 4,
          height: scaleDimension(40, uiScale),
          marginHorizontal: scaleDimension(4, uiScale),
          marginVertical: scaleDimension(4, uiScale),
        },
        flex: { flex: 1 },
        marginBottom: { marginBottom: scaleDimension(8, uiScale) },
      }),
    [uiScale],
  );

  const onDismiss = () => {
    closeModal();
    if (error) {
      setText(color);
    }
    setError(null);
  };

  const onChangeText = (txt: string) => setText(txt);

  const onSubmitEditing = () => {
    const re = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i;

    if (text.match(re)) {
      onSubmit(text);
      closeModal();
    } else {
      setError('Enter a valid hex color code');
    }
  };

  const accentColors = [
    '#EF5350',
    '#EC407A',
    '#AB47BC',
    '#7E57C2',
    '#5C6BC0',
    '#42A5F5',
    '#29B6FC',
    '#26C6DA',
    '#26A69A',
    '#66BB6A',
    '#9CCC65',
    '#D4E157',
    '#FFEE58',
    '#FFCA28',
    '#FFA726',
    '#FF7043',
    '#8D6E63',
    '#BDBDBD',
    '#78909C',
    '#000000',
  ];

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {title}
        </Text>
        {showAccentColors ? (
          <FlatList
            contentContainerStyle={styles.marginBottom}
            data={accentColors}
            numColumns={4}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <View style={[styles.item, { backgroundColor: item }]}>
                <Pressable
                  style={styles.flex}
                  android_ripple={{
                    color: 'rgba(0,0,0,0.12)',
                  }}
                  onPress={() => {
                    onSubmit(item);
                    closeModal();
                  }}
                />
              </View>
            )}
          />
        ) : null}
        <TextInput
          value={text}
          defaultValue={typeof color === 'string' ? color : ''}
          placeholder="Hex Color Code (E.g. #3399FF)"
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          underlineColor={theme.outline}
          dense
          error={Boolean(error)}
        />
        <Text style={styles.errorText}>{error}</Text>
      </Modal>
    </Portal>
  );
};

export default ColorPickerModal;
