import { useTheme } from '@hooks/persisted';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface EmptyViewProps {
  icon: string;
  description: string;
  style?: any;
  children?: React.ReactNode;
  iconStyle?: any;
}

const EmptyView = ({
  icon,
  description,
  style,
  children,
  iconStyle,
}: EmptyViewProps) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        emptyViewContainer: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        },
        emptyViewIcon: {
          fontSize: scaleDimension(45, uiScale),
        },
        emptyViewText: {
          fontWeight: 'bold',
          marginTop: scaleDimension(10, uiScale),
          paddingHorizontal: scaleDimension(30, uiScale),
          textAlign: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.emptyViewContainer}>
      <Text
        style={[
          styles.emptyViewIcon,
          { color: theme.outline },
          style,
          iconStyle,
        ]}
      >
        {icon}
      </Text>
      <Text style={[styles.emptyViewText, { color: theme.outline }, style]}>
        {description}
      </Text>
      {children}
    </View>
  );
};

export default EmptyView;
