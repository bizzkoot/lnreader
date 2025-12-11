import React from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { LegendList, LegendListRenderItemProps } from '@legendapp/list';
import color from 'color';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { ThemeColors } from '@theme/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlay } from 'react-native-paper';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface PageNavigationBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  theme: ThemeColors;
  pages: string[];
  pageIndex: number;
  openPage: (index: number) => void;
}

export default function PageNavigationBottomSheet({
  bottomSheetRef,
  theme,
  pages,
  pageIndex,
  openPage,
}: PageNavigationBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { left, right } = insets;
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);

  const renderItem = ({ item, index }: LegendListRenderItemProps<string>) => {
    const isSelected = index === pageIndex;

    const pageItemContainerStyle = {
      backgroundColor: isSelected
        ? theme.isDark
          ? color(theme.primary).alpha(0.2).string()
          : color(theme.primaryContainer).alpha(0.5).string()
        : 'transparent',
    };

    return (
      <View style={[styles.pageItemContainer, pageItemContainerStyle]}>
        <Pressable
          android_ripple={{
            color: isSelected
              ? color(theme.primary).alpha(0.2).string()
              : theme.rippleColor,
          }}
          style={styles.pageItem}
          onPress={() => {
            openPage(index);
            bottomSheetRef.current?.close();
          }}
        >
          <View style={styles.pageItemContent}>
            <Text
              style={[
                styles.pageText,
                {
                  color: isSelected ? theme.primary : theme.onSurfaceVariant,
                },
              ]}
            >
              Page {item}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <BottomSheet
      bottomSheetRef={bottomSheetRef}
      snapPoints={[
        Math.min(
          scaleDimension(400, uiScale),
          pages.length * scaleDimension(56, uiScale) +
            scaleDimension(100, uiScale),
        ),
      ]}
      backgroundStyle={styles.transparent}
    >
      <BottomSheetView
        style={[
          styles.contentContainer,
          {
            backgroundColor: overlay(2, theme.surface),
            marginLeft: left,
            marginRight: right,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <BottomSheetScrollView>
          <LegendList
            data={pages}
            recycleItems
            extraData={pageIndex}
            renderItem={renderItem}
            keyExtractor={(item, index) => `page_${index}_${item}`}
            estimatedItemSize={56}
            contentContainerStyle={styles.listContent}
          />
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    contentContainer: {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      flex: 1,
      maxHeight: scaleDimension(400, uiScale),
    },
    listContent: {
      paddingBottom: scaleDimension(8, uiScale),
      paddingTop: scaleDimension(4, uiScale),
    },
    pageItem: {
      flex: 1,
      justifyContent: 'center',
      minHeight: scaleDimension(56, uiScale),
      paddingHorizontal: scaleDimension(24, uiScale),
      paddingVertical: scaleDimension(16, uiScale),
    },
    pageItemContainer: {
      borderRadius: 0,
      marginHorizontal: 0,
      overflow: 'hidden',
    },
    pageItemContent: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    pageText: {},
    selectedIndicator: {
      borderRadius: 2,
      height: scaleDimension(20, uiScale),
      width: scaleDimension(3, uiScale),
    },
    transparent: {
      backgroundColor: 'transparent',
    },
  });
