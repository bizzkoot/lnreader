import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import AppText from '@components/AppText';

import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface DialogTitleProps {
  title: string;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ title }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        dialogTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <AppText style={[styles.dialogTitle, { color: theme.onSurface }]}>
      {title}
    </AppText>
  );
};
