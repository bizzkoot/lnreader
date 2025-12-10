import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { useTheme } from '@hooks/persisted';
import { getErrorMessage } from '@utils/error';
import { MaterialDesignIconName } from '@type/icon';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface ErrorScreenProps {
  error: any;
  actions?: Array<{
    iconName: MaterialDesignIconName;
    title: string;
    onPress: () => void;
  }>;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, actions }) => {
  const theme = useTheme();
  const { iconSize } = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionsCtn: {
          flexDirection: 'row',
          marginTop: scaleDimension(20, uiScale),
        },
        buttonCtn: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          paddingVertical: scaleDimension(8, uiScale),
        },
        buttonWrapper: {
          borderRadius: scaleDimension(50, uiScale),
          flexDirection: 'row',
          flex: 1 / 3,
          marginHorizontal: scaleDimension(4, uiScale),
          overflow: 'hidden',
        },
        container: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
        },
        error: {
          marginTop: scaleDimension(16, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
          textAlign: 'center',
        },
        icon: {
          fontSize: scaleDimension(44, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { color: theme.outline }]}>ಥ_ಥ</Text>
      <Text style={[styles.error, { color: theme.outline }]}>
        {getErrorMessage(error)}
      </Text>
      {actions?.length ? (
        <View style={styles.actionsCtn}>
          {actions.map(action => (
            <View key={action.title} style={styles.buttonWrapper}>
              <Pressable
                android_ripple={{ color: theme.rippleColor }}
                onPress={action.onPress}
                style={styles.buttonCtn}
              >
                <MaterialCommunityIcons
                  name={action.iconName}
                  size={iconSize.md}
                  color={theme.outline}
                />
                <Text style={{ color: theme.outline }}>{action.title}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default ErrorScreen;
