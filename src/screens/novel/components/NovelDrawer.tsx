import { LegendList, LegendListRenderItemProps } from '@legendapp/list';
import { ThemeColors } from '@theme/types';
import color from 'color';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import React, { useMemo } from 'react';

interface NovelDrawerProps {
  theme: ThemeColors;
  pages: string[];
  pageIndex: number;
  openPage: (index: number) => void;
  closeDrawer: () => void;
}
export default function NovelDrawer({
  theme,
  pages,
  pageIndex,
  openPage,
  closeDrawer,
}: NovelDrawerProps) {
  const insets = useSafeAreaInsets();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        drawer: {
          flex: 1,
          height: scaleDimension(100, uiScale),
          paddingTop: scaleDimension(60, uiScale),
        },
        drawerElementContainer: {
          borderRadius: 50,
          margin: scaleDimension(4, uiScale),
          marginLeft: scaleDimension(16, uiScale),
          marginRight: scaleDimension(16, uiScale),
          minHeight: scaleDimension(48, uiScale),
          overflow: 'hidden',
        },
        headerCtn: {
          borderBottomWidth: 1,
          fontSize: scaleDimension(16, uiScale),
          fontWeight: '500',
          marginBottom: scaleDimension(4, uiScale),
          padding: scaleDimension(16, uiScale),
        },
        pageCtn: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: scaleDimension(20, uiScale),
          paddingVertical: scaleDimension(10, uiScale),
        },
        pageText: {
          fontSize: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  const renderItem = ({ item, index }: LegendListRenderItemProps<string>) => (
    <View
      style={[
        styles.drawerElementContainer,
        index === pageIndex && {
          backgroundColor: color(theme.primary).alpha(0.12).string(),
        },
      ]}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        style={styles.pageCtn}
        onPress={() => {
          openPage(index);
          closeDrawer();
        }}
      >
        <View>
          <Text style={[{ color: theme.onSurfaceVariant }, styles.pageText]}>
            {item}
          </Text>
        </View>
      </Pressable>
    </View>
  );
  return (
    <View
      style={[
        styles.drawer,
        { backgroundColor: theme.surface, paddingBottom: insets.bottom },
      ]}
    >
      <Text
        style={[
          styles.headerCtn,
          { color: theme.onSurface, borderBottomColor: theme.outline },
        ]}
      >
        Novel pages
      </Text>
      <LegendList
        data={pages}
        recycleItems
        extraData={pageIndex}
        renderItem={renderItem}
        keyExtractor={(item, index) => `novel_page_${index}_${item}`}
        estimatedItemSize={60}
      />
    </View>
  );
}
