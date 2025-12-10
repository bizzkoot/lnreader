import React, { useMemo } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';

import { ThemeColors } from '../../theme/types';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { scaleDimension } from '@theme/scaling';

const LoadingScreen: React.FC<{ theme: ThemeColors }> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        indicator: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <ActivityIndicator
      size={iconSize.lg + scaleDimension(2, uiScale)}
      color={theme.primary}
      style={styles.indicator}
    />
  );
};

export default LoadingScreen;
