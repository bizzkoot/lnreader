import React from 'react';
import { StyleSheet } from 'react-native';
import AppText from '@components/AppText';

import { Portal } from 'react-native-paper';

import { RadioButton } from '@components/RadioButton/RadioButton';

import { ThemeColors } from '@theme/types';
import { useLibrarySettings, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { Modal } from '@components';

interface GridSizeModalProps {
  novelsPerRow: number;
  gridSizeModalVisible: boolean;
  hideGridSizeModal: () => void;
  theme: ThemeColors;
}

const GridSizeModal: React.FC<GridSizeModalProps> = ({
  novelsPerRow,
  gridSizeModalVisible,
  hideGridSizeModal,
  theme,
}) => {
  const { setLibrarySettings } = useLibrarySettings();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        modalDescription: {
          fontSize: scaleDimension(16, uiScale),
          marginBottom: 16,
        },
        modalHeader: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: 10,
        },
        slider: {
          height: 40,
          width: '100%',
        },
      }),
    [uiScale],
  );

  const gridSizes = {
    5: 'XS',
    4: 'S',
    3: 'M',
    2: 'L',
    1: 'XL',
  };

  return (
    <Portal>
      <Modal visible={gridSizeModalVisible} onDismiss={hideGridSizeModal}>
        <AppText style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.gridSize')}
        </AppText>
        <AppText
          style={[styles.modalDescription, { color: theme.onSurfaceVariant }]}
        >
          {getString('generalSettingsScreen.gridSizeDesc', {
            num: novelsPerRow,
          })}
        </AppText>
        {Object.keys(gridSizes).map(item => {
          const it = Number(item);
          return (
            <RadioButton
              key={item}
              status={it === novelsPerRow}
              // @ts-ignore
              label={gridSizes[it]}
              onPress={() => setLibrarySettings({ novelsPerRow: it })}
              theme={theme}
              labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
            />
          );
        })}
      </Modal>
    </Portal>
  );
};

export default GridSizeModal;
