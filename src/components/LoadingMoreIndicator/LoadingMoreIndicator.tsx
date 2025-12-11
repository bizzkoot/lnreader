import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { ThemeColors } from '../../theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface Props {
  theme: ThemeColors;
}

const LoadingMoreIndicator: React.FC<Props> = ({ theme }) => {
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        indicator: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          padding: scaleDimension(32, uiScale),
        },
      }),
    [uiScale],
  );

  return <ActivityIndicator color={theme.primary} style={styles.indicator} />;
};

export default LoadingMoreIndicator;
