import React from 'react';

import { Portal } from 'react-native-paper';
import { RadioButton } from '@components/RadioButton/RadioButton';

import {
  useChapterReaderSettings,
  useTheme,
  useAppSettings,
} from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { readerFonts } from '@utils/constants/readerConstants';
import { Modal } from '@components';

interface FontPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentFont: string;
}

const FontPickerModal: React.FC<FontPickerModalProps> = ({
  currentFont,
  onDismiss,
  visible,
}) => {
  const theme = useTheme();
  const { setChapterReaderSettings } = useChapterReaderSettings();
  const { uiScale = 1.0 } = useAppSettings();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        {readerFonts.map(item => (
          <RadioButton
            key={item.fontFamily}
            status={currentFont === item.fontFamily}
            onPress={() =>
              setChapterReaderSettings({ fontFamily: item.fontFamily })
            }
            label={item.name}
            labelStyle={{
              fontFamily: item.fontFamily,
              fontSize: scaleDimension(16, uiScale),
            }}
            theme={theme}
          />
        ))}
      </Modal>
    </Portal>
  );
};

export default FontPickerModal;
