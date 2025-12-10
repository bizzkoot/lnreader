import { useAppSettings, useTheme } from '@hooks/persisted';
import * as React from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import useLoadingColors from './useLoadingColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { scaleDimension } from '@theme/scaling';

const duration = 1000;

function useSetupLoadingAnimations() {
  const sv = useSharedValue(0);
  const { disableLoadingAnimations, uiScale = 1.0 } = useAppSettings();
  const theme = useTheme();
  const [highlightColor, backgroundColor] = useLoadingColors(theme);

  const style = useAnimatedProps(() => {
    return {
      left: (sv.value + '%') as `${number}%`,
    };
  });

  const LGC = React.useMemo(
    () => createLGC(highlightColor, style, disableLoadingAnimations, uiScale),
    [disableLoadingAnimations, highlightColor, style, uiScale],
  );

  React.useEffect(() => {
    if (disableLoadingAnimations) return;
    sv.value = withRepeat(withSequence(0, withTiming(160, { duration })), -1);
  }, [disableLoadingAnimations, sv]);
  return [LGC, backgroundColor] as const;
}

function createLGC(
  highlightColor: string,
  style: StyleProp<ViewStyle>,
  disableLoadingAnimations?: boolean,
  scale: number = 1,
) {
  if (disableLoadingAnimations) return <></>;
  const LG = Animated.createAnimatedComponent(LinearGradient);

  return (
    <React.Suspense fallback={<></>}>
      <LG
        start={[0, 0]}
        end={[1, 0]}
        locations={[0, 0.3, 0.7, 1]}
        style={[
          style,
          {
            height: scaleDimension(40, scale),
            position: 'absolute' as const,
            transform: [{ translateX: '-100%' }],
            width: '60%',
          },
        ]}
        colors={['transparent', highlightColor, highlightColor, 'transparent']}
      />
    </React.Suspense>
  );
}

const ChapterSkeleton = React.memo(function ChapterSkeleton({
  lgc,
  backgroundStyle,
  img,
}: {
  lgc: React.JSX.Element;
  backgroundStyle: StyleProp<ViewStyle>;
  img?: boolean;
}) {
  const { uiScale = 1.0 } = useAppSettings();
  const { borderRadius } = useScaledDimensions();

  const styles = React.useMemo(
    () => ({
      chapter: {
        flexDirection: 'row' as const,
        marginHorizontal: scaleDimension(16, uiScale),
        marginVertical: scaleDimension(8, uiScale),
        height: scaleDimension(40, uiScale),
      },
      chapterText: {
        height: scaleDimension(40, uiScale),
        overflow: 'hidden' as const,
        position: 'relative' as const,
        flex: 1,
      },
      default: {
        borderRadius: borderRadius.xs,
        overflow: 'hidden' as const,
      },
      img: {
        alignSelf: 'center' as const,
        height: scaleDimension(40, uiScale),
        marginRight: scaleDimension(20, uiScale),
        width: scaleDimension(40, uiScale),
      },
      h20: {
        height: scaleDimension(20, uiScale),
        marginBottom: scaleDimension(5, uiScale),
      },
      h15: {
        height: scaleDimension(15, uiScale),
      },
      circle: {
        alignSelf: 'center' as const,
        borderRadius: scaleDimension(20, uiScale),
        height: scaleDimension(30, uiScale),
        marginLeft: scaleDimension(20, uiScale),
        width: scaleDimension(30, uiScale),
      },
    }),
    [uiScale, borderRadius],
  );

  return (
    <View style={styles.chapter}>
      {img ? (
        <View style={[styles.default, styles.img, backgroundStyle]}>{lgc}</View>
      ) : (
        <></>
      )}
      <View style={styles.chapterText}>
        <View style={[styles.default, styles.h20, backgroundStyle]}>{lgc}</View>
        <View style={[styles.default, styles.h15, backgroundStyle]}>{lgc}</View>
      </View>
      <View style={[styles.default, styles.circle, backgroundStyle]}>
        {lgc}
      </View>
    </View>
  );
});

function VerticalBarSkeleton() {
  const [LGC, backgroundColor] = useSetupLoadingAnimations();
  const { uiScale = 1.0 } = useAppSettings();
  const { margin, borderRadius } = useScaledDimensions();

  const styles = React.useMemo(
    () => ({
      verticalBar: {
        borderRadius: borderRadius.xs,
        marginHorizontal: margin.md,
        marginVertical: margin.md,
        height: scaleDimension(24, uiScale),
        overflow: 'hidden' as const,
      },
    }),
    [uiScale, margin, borderRadius],
  );

  return <View style={[{ backgroundColor }, styles.verticalBar]}>{LGC}</View>;
}

function NovelMetaSkeleton() {
  const [LGC, backgroundColor] = useSetupLoadingAnimations();
  const { uiScale = 1.0 } = useAppSettings();
  const { borderRadius } = useScaledDimensions();

  const styles = React.useMemo(
    () => ({
      novelInformationText: {
        height: scaleDimension(110, uiScale),
        marginBottom: scaleDimension(2.5, uiScale),
        marginHorizontal: scaleDimension(16, uiScale),
        marginTop: scaleDimension(8, uiScale),
        paddingTop: scaleDimension(5, uiScale),
      },
      flex: { flex: 1 },
      h20: {
        height: scaleDimension(20, uiScale),
        marginBottom: scaleDimension(5, uiScale),
      },
      default: {
        borderRadius: borderRadius.xs,
        overflow: 'hidden' as const,
      },
      metaGap: {
        marginTop: scaleDimension(22, uiScale),
      },
      row: { flexDirection: 'row' as const },
      chip: {
        borderRadius: scaleDimension(8, uiScale),
        height: scaleDimension(30, uiScale),
        marginRight: scaleDimension(8, uiScale),
        width: scaleDimension(80, uiScale),
      },
    }),
    [uiScale, borderRadius],
  );

  const Chips = React.useMemo(
    () => (
      <View
        style={[
          styles.default,
          styles.chip,
          {
            backgroundColor: backgroundColor,
          },
        ]}
      >
        {LGC}
      </View>
    ),
    [LGC, backgroundColor, styles],
  );

  return (
    <View style={styles.novelInformationText}>
      <View style={[styles.flex, { height: scaleDimension(20, uiScale) }]}>
        <View
          style={[
            styles.default,
            styles.h20,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          {LGC}
        </View>
        <View
          style={[
            styles.default,
            styles.h20,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          {LGC}
        </View>
        <View style={[styles.metaGap, styles.row, styles.flex]}>
          {Chips}
          {Chips}
          {Chips}
          {Chips}
        </View>
      </View>
    </View>
  );
}

const ChapterListSkeleton = ({ img }: { img?: boolean }) => {
  const sv = useSharedValue(0);
  const { disableLoadingAnimations, uiScale = 1.0 } = useAppSettings();

  React.useEffect(() => {
    if (disableLoadingAnimations) return;
    sv.value = withRepeat(withSequence(0, withTiming(160, { duration })), -1);
  }, [disableLoadingAnimations, sv]);

  const skeletonItems = React.useMemo(() => Array.from({ length: 7 }), []);

  const animatedProps = useAnimatedProps(() => {
    return {
      left: (sv.value + '%') as `${number}%`,
    };
  });
  const theme = useTheme();
  const [highlightColor, backgroundColor] = useLoadingColors(theme);

  const LGC = React.useMemo(
    () =>
      createLGC(
        highlightColor,
        animatedProps,
        disableLoadingAnimations,
        uiScale,
      ),
    [animatedProps, disableLoadingAnimations, highlightColor, uiScale],
  );
  const backgroundStyle = React.useMemo(
    () => ({ backgroundColor }),
    [backgroundColor],
  );

  return (
    <>
      {skeletonItems.map((_, i) => (
        <ChapterSkeleton
          key={i}
          lgc={LGC}
          backgroundStyle={backgroundStyle}
          img={img}
        />
      ))}
    </>
  );
};

export { ChapterListSkeleton, NovelMetaSkeleton, VerticalBarSkeleton };
