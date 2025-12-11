import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@components/AppText';

import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '../../../theme/types';
import { MaterialDesignIconName } from '@type/icon';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

interface Props {
  label: string;
  icon?: MaterialDesignIconName;
  backgroundColor?: string;
  textColor?: string;
  theme: ThemeColors;
}

export const Banner: React.FC<Props> = ({
  label,
  icon,
  theme,
  backgroundColor = theme.primary,
  textColor = theme.onPrimary,
}) => {
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        bannerText: {
          fontSize: scaleDimension(12, uiScale),
          fontWeight: '500',
        },
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          paddingVertical: 4,
        },
        icon: {
          marginRight: 8,
        },
      }),
    [uiScale],
  );

  return (
    <View style={[{ backgroundColor }, styles.container]}>
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          color={textColor}
          size={iconSize.sm}
          style={styles.icon}
        />
      ) : null}
      <AppText style={[{ color: textColor }, styles.bannerText]}>
        {label}
      </AppText>
    </View>
  );
};
