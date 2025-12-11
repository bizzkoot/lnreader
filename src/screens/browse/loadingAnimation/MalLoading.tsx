import React, { memo, useMemo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeColors } from '@theme/types';

import useLoadingColors from '@utils/useLoadingColors';
import { useAppSettings } from '@hooks/persisted/index';
import { scaleDimension } from '@theme/scaling';

interface Props {
  theme: ThemeColors;
}

const MalLoading: React.FC<Props> = ({ theme }) => {
  const { disableLoadingAnimations, uiScale = 1.0 } = useAppSettings();
  const ShimmerPlaceHolder = createShimmerPlaceholder(LinearGradient);
  const styles = useMemo(
    () => createStyleSheet(theme, uiScale),
    [theme, uiScale],
  );

  const [highlightColor, backgroundColor] = useLoadingColors(theme);

  const renderLoadingRect = (item: number, index: number) => {
    let randomNumber = Math.random();
    if (randomNumber < 0.1) {
      randomNumber = 0.1;
    }
    return (
      <View key={index} style={styles.loadingContainer}>
        <ShimmerPlaceHolder
          shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
          height={120 + Math.random() * 28}
          width={100}
          stopAutoRun={disableLoadingAnimations}
        />
        <View style={styles.loadingText}>
          <ShimmerPlaceHolder
            style={styles.text}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={16}
            width={Dimensions.get('window').width - 140}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceHolder
            style={styles.text}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={16}
            width={Dimensions.get('window').width - 140}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceHolder
            style={styles.text}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={16}
            width={randomNumber * (Dimensions.get('window').width - 140)}
            stopAutoRun={disableLoadingAnimations}
          />
        </View>
      </View>
    );
  };
  const items: Array<number> = [0, 1, 2, 3, 4];
  return <View style={styles.container}>{items.map(renderLoadingRect)}</View>;
};

const createStyleSheet = (theme: ThemeColors, uiScale: number) => {
  return StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      flexGrow: 1,
      marginBottom: 8,
      marginTop: -3,
      overflow: 'hidden',
      position: 'relative',
      //   height: 150,
    },
    loadingContainer: {
      backgroundColor: theme.overlay3,
      borderRadius: 8,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      flexDirection: 'row',
      margin: 10,
      overflow: 'hidden',
    },
    loadingText: {
      height: scaleDimension(10, uiScale),
      margin: scaleDimension(10, uiScale),
      width: Dimensions.get('window').width - scaleDimension(140, uiScale),
    },
    text: {
      borderRadius: 8,
      marginVertical: 5,
    },
  });
};

export default memo(MalLoading);
