import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Appbar, List } from '@components';
import { AboutScreenProps, MoreStackScreenProps } from '@navigators/types';
import { ThemeColors } from '@theme/types';
import { scaleDimension } from '@theme/scaling';

interface MoreHeaderProps {
  title: string;
  navigation:
    | AboutScreenProps['navigation']
    | MoreStackScreenProps['navigation'];
  theme: ThemeColors;
  goBack?: boolean;
  uiScale?: number;
}

export const MoreHeader = ({
  title,
  navigation,
  theme,
  goBack,
  uiScale = 1.0,
}: MoreHeaderProps) => (
  <>
    <Appbar
      title={title}
      handleGoBack={goBack ? navigation.goBack : undefined}
      mode="small"
      theme={theme}
    />
    <View style={styles.overflow}>
      <View style={[styles.logoContainer, { backgroundColor: theme.surface }]}>
        <Image
          source={require('../../../../assets/logo.png')}
          style={[getLogoStyle(uiScale), { tintColor: theme.onSurface }]}
        />
      </View>
    </View>
    <List.Divider theme={theme} />
  </>
);

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 4,
  },
  overflow: {
    overflow: 'hidden' as const,
    paddingBottom: 4,
  },
});

const getLogoStyle = (uiScale: number) => ({
  height: scaleDimension(90, uiScale),
  width: scaleDimension(90, uiScale),
});
