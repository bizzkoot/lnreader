import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

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
    <Text style={[styles.dialogTitle, { color: theme.onSurface }]}>
      {title}
    </Text>
  );
};
