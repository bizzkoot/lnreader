import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeColors } from '@theme/types';
import useLoadingColors from '@utils/useLoadingColors';
import { useAppSettings } from '@hooks/persisted/index';
import Animated, { FadeIn } from 'react-native-reanimated';
import { scaleDimension } from '@theme/scaling';

interface Props {
  theme: ThemeColors;
}

const UpdatesSkeletonLoading: React.FC<Props> = ({ theme }) => {
  const { disableLoadingAnimations, uiScale = 1.0 } = useAppSettings();
  const ShimmerPlaceHolder = createShimmerPlaceholder(LinearGradient);
  const [highlightColor, backgroundColor] = useLoadingColors(theme);
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  const renderLoadingChapter = (item: number, index: number) => {
    return (
      <View style={styles.chapterCtn} key={index}>
        <ShimmerPlaceHolder
          style={styles.picture}
          shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
          height={42}
          width={42}
          stopAutoRun={disableLoadingAnimations}
        />
        <View>
          <ShimmerPlaceHolder
            style={styles.textTop}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={16}
            width={257.5}
            stopAutoRun={disableLoadingAnimations}
          />
          <ShimmerPlaceHolder
            style={styles.textBottom}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={12}
            width={257.5}
            stopAutoRun={disableLoadingAnimations}
          />
        </View>
        <View style={styles.buttonCtn}>
          <ShimmerPlaceHolder
            style={styles.button}
            shimmerColors={[backgroundColor, highlightColor, backgroundColor]}
            height={25}
            width={25}
            stopAutoRun={disableLoadingAnimations}
          />
        </View>
      </View>
    );
  };

  const items = [];
  for (let index = 0; index < Math.random() * 8 + 4; index++) {
    items.push(0);
  }

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.contentCtn}>
      {items.map(renderLoadingChapter)}
    </Animated.View>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    button: {
      borderRadius: 12.5,
    },
    buttonCtn: {
      alignItems: 'center',
      height: scaleDimension(45.1, uiScale),
      justifyContent: 'center',
      width: scaleDimension(45.1, uiScale),
    },
    chapterCtn: {
      alignItems: 'center',
      flexDirection: 'row',
      marginVertical: 8,
    },
    contentCtn: {
      paddingVertical: 8,
    },
    picture: {
      borderRadius: 4,
      height: scaleDimension(42, uiScale),
      marginHorizontal: scaleDimension(16, uiScale),
      width: scaleDimension(42, uiScale),
    },
    textBottom: {
      borderRadius: 6,
      marginBottom: 5,
      marginTop: 2,
    },
    textTop: {
      borderRadius: 6,
      marginBottom: 2,
      marginTop: 5,
    },
  });

export default memo(UpdatesSkeletonLoading);
