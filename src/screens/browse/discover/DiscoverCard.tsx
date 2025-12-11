import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  ImageSourcePropType,
} from 'react-native';
import { getString } from '@strings/translations';
import { Button } from '@components';

import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

interface Props {
  trackerName: string;
  icon: ImageSourcePropType;
  onPress: () => void;
  theme: ThemeColors;
}

const DiscoverCard: React.FC<Props> = ({
  theme,
  icon,
  trackerName,
  onPress,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: scaleDimension(16, uiScale),
          paddingVertical: scaleDimension(12, uiScale),
        },
        details: {
          marginLeft: scaleDimension(16, uiScale),
        },
        flexRow: {
          alignItems: 'center',
          flexDirection: 'row',
        },
        icon: {
          borderRadius: scaleDimension(4, uiScale),
          height: scaleDimension(40, uiScale),
          width: scaleDimension(40, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor }}
    >
      <View style={styles.flexRow}>
        <Image source={icon} style={styles.icon} />
        <View style={styles.details}>
          <AppText
            style={{
              color: theme.onSurface,
              fontSize: scaleDimension(14, uiScale),
            }}
          >
            {trackerName}
          </AppText>
        </View>
      </View>
      <View style={styles.flexRow}>
        <Button
          title={getString('browse')}
          textColor={theme.primary}
          onPress={onPress}
        />
      </View>
    </Pressable>
  );
};

export default DiscoverCard;
