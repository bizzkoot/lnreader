import React, { useMemo } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
import color from 'color';

import BottomSheet from '@components/BottomSheet/BottomSheet';
import { ThemeColors } from '@theme/types';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlay } from 'react-native-paper';

const PageNavigationItem: React.FC<{
  item: string;
  index: number;
  pageIndex: number;
  theme: ThemeColors;
  openPage: (index: number) => void;
  bottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
}> = ({ item, index, pageIndex, theme, openPage, bottomSheetRef }) => {
  const isSelected = index === pageIndex;

  const containerStyleComputed = useMemo(
    () => [
      styles.pageItemContainer,
      {
        backgroundColor: isSelected
          ? theme.isDark
            ? color(theme.primary).alpha(0.2).string()
            : color(theme.primaryContainer).alpha(0.5).string()
          : 'transparent',
      },
    ],
    [isSelected, theme.primary, theme.primaryContainer, theme.isDark],
  );

  const rippleColor = useMemo(
    () => (isSelected ? color(theme.primary).alpha(0.2).string() : theme.rippleColor),
    [isSelected, theme.primary, theme.rippleColor],
  );

  const textColor = useMemo(
    () => (isSelected ? theme.primary : theme.onSurfaceVariant),
    [isSelected, theme.primary, theme.onSurfaceVariant],
  );

  return (
    <View style={containerStyleComputed}>
      <Pressable
        android_ripple={{ color: rippleColor }}
        style={styles.pageItem}
        onPress={() => {
          openPage(index);
          bottomSheetRef.current?.close();
        }}
      >
        <View style={styles.pageItemContent}>
          <Text style={[styles.pageText, { color: textColor }]}>Page {item}</Text>
        </View>
      </Pressable>
    </View>
  );
};

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

  const contentViewStyle = useMemo(
    () => [
      styles.contentContainer,
      {
        backgroundColor: overlay(2, theme.surface),
        marginLeft: left,
        marginRight: right,
        paddingBottom: insets.bottom,
      },
    ],
    [theme.surface, left, right, insets.bottom],
  );

  

  return (
    <BottomSheet
      bottomSheetRef={bottomSheetRef}
      snapPoints={[Math.min(400, pages.length * 56 + 100)]}
      backgroundStyle={styles.transparent}
    >
      <BottomSheetView style={contentViewStyle}
      >
        <BottomSheetScrollView>
          <LegendList
            data={pages}
            recycleItems
            extraData={pageIndex}
            renderItem={({ item, index }) => (
              <PageNavigationItem
                item={item}
                index={index}
                pageIndex={pageIndex}
                theme={theme}
                openPage={openPage}
                bottomSheetRef={bottomSheetRef}
              />
            )}
            estimatedItemSize={56}
            contentContainerStyle={styles.listContent}
          />
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flex: 1,
    maxHeight: 400,
  },
  listContent: {
    paddingBottom: 8,
    paddingTop: 4,
  },
  pageItem: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    height: 20,
    width: 3,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
