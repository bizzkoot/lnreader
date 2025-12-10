import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { ThemeColors } from '../../theme/types';
import { Button } from 'react-native-paper';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface EmptyViewProps {
  icon?: string;
  description: string;
  theme: ThemeColors;
  actions?: Array<{
    iconName: string;
    title: string;
    onPress: () => void;
  }>;
}

const EmptyView: React.FC<EmptyViewProps> = ({
  icon,
  description,
  theme,
  actions,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionsCtn: {
          flexDirection: 'row',
          marginTop: scaleDimension(20, uiScale),
        },
        buttonWrapper: {
          flexDirection: 'row',
          marginHorizontal: scaleDimension(4, uiScale),
        },
        container: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          padding: scaleDimension(16, uiScale),
        },
        icon: {
          fontSize: scaleDimension(40, uiScale),
          fontWeight: 'bold',
        },
        text: {
          marginTop: scaleDimension(16, uiScale),
          textAlign: 'center',
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      {icon ? (
        <Text style={[styles.icon, { color: theme.outline }]}>{icon}</Text>
      ) : null}
      <Text style={[styles.text, { color: theme.outline }]}>{description}</Text>
      {actions?.length ? (
        <View style={styles.actionsCtn}>
          {actions.map(action => (
            <View key={action.title} style={styles.buttonWrapper}>
              <Button
                rippleColor={theme.rippleColor}
                onPress={action.onPress}
                icon={action.iconName}
                textColor={theme.outline}
                mode="outlined"
              >
                {action.title}
              </Button>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default EmptyView;
