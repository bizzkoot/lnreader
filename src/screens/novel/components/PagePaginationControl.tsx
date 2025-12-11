import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { IconButton } from 'react-native-paper';
import color from 'color';
import { ThemeColors } from '@theme/types';
import { borderColor } from '@theme/colors';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import AppText from '@components/AppText';

interface PagePaginationControlProps {
  pages: string[];
  currentPageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onOpenDrawer: () => void;
  theme: ThemeColors;
}

const PagePaginationControl: React.FC<PagePaginationControlProps> = ({
  pages,
  currentPageIndex,
  onPageChange,
  onOpenDrawer,
  theme,
}) => {
  const { uiScale = 1.0 } = useAppSettings();
  const { iconSize } = useScaledDimensions();
  const totalPages = pages.length;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: scaleDimension(16, uiScale),
          paddingTop: scaleDimension(12, uiScale),
        },
        pageButton: {
          alignItems: 'center',
          borderRadius: scaleDimension(8, uiScale),
          borderWidth: 1,
          height: scaleDimension(40, uiScale),
          justifyContent: 'center',
          minWidth: scaleDimension(40, uiScale),
          paddingHorizontal: scaleDimension(12, uiScale),
          marginHorizontal: scaleDimension(4, uiScale),
        },
        ellipsis: {
          fontSize: scaleDimension(16, uiScale),
          marginHorizontal: scaleDimension(4, uiScale),
        },
        ellipsisButton: {
          borderStyle: 'dashed',
        },
        currentPage: {
          backgroundColor: theme.primary,
        },
        currentPageText: {
          color: theme.onPrimary,
          fontSize: scaleDimension(15, uiScale),
          maxWidth: scaleDimension(100, uiScale),
        },
        pageText: {
          color: theme.onSurface,
          fontSize: scaleDimension(15, uiScale),
          maxWidth: scaleDimension(100, uiScale),
        },
        disabledButton: {
          opacity: 0.5,
        },
        iconButton: {
          margin: 0,
        },
        pageNumbersRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: scaleDimension(8, uiScale),
        },
      }),
    [uiScale, theme],
  );

  const pageIndices = useMemo(() => {
    const indices: (number | 'ellipsis')[] = [];

    if (totalPages <= 3) {
      for (let i = 0; i < totalPages; i++) {
        indices.push(i);
      }
    } else {
      if (currentPageIndex !== 0) {
        indices.push(0);
      }

      const leftPageIndex = currentPageIndex - 1;
      if (leftPageIndex > 0) {
        if (leftPageIndex > 1) {
          indices.push('ellipsis');
        }
        indices.push(leftPageIndex);
      }

      indices.push(currentPageIndex);

      if (currentPageIndex < totalPages - 1) {
        indices.push('ellipsis');
      }

      if (currentPageIndex !== totalPages - 1) {
        indices.push(totalPages - 1);
      }
    }

    return indices;
  }, [currentPageIndex, totalPages]);

  const canGoPrevious = currentPageIndex > 0;
  const canGoNext = currentPageIndex < totalPages - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(currentPageIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPageIndex + 1);
    }
  };

  const handlePagePress = (pageIndex: number) => {
    if (pageIndex !== currentPageIndex) {
      onPageChange(pageIndex);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.pageButton,
          {
            borderColor: borderColor,
            backgroundColor: theme.surface,
          },
          !canGoPrevious && styles.disabledButton,
        ]}
        onPress={handlePrevious}
        disabled={!canGoPrevious}
        android_ripple={{ color: theme.rippleColor }}
      >
        <IconButton
          icon="chevron-left"
          iconColor={canGoPrevious ? theme.onSurface : theme.onSurfaceDisabled}
          size={iconSize.sm}
          style={styles.iconButton}
        />
      </Pressable>

      <View style={styles.pageNumbersRow}>
        {pageIndices.map((pageIndex, index) => {
          if (pageIndex === 'ellipsis') {
            return (
              <Pressable
                key={`ellipsis-${index}`}
                style={[
                  styles.pageButton,
                  styles.ellipsisButton,
                  {
                    borderColor: borderColor,
                    backgroundColor: theme.surface,
                  },
                ]}
                onPress={onOpenDrawer}
                android_ripple={{ color: theme.rippleColor }}
              >
                <AppText style={[styles.ellipsis, { color: theme.onSurface }]}>
                  ...
                </AppText>
              </Pressable>
            );
          }

          const isActive = pageIndex === currentPageIndex;
          const pageName = pages[pageIndex];
          return (
            <Pressable
              key={`page-${pageIndex}`}
              style={[
                styles.pageButton,
                isActive && styles.currentPage,
                {
                  backgroundColor: isActive ? theme.primary : theme.surface,
                },
              ]}
              onPress={() => handlePagePress(pageIndex)}
              android_ripple={{
                color: isActive
                  ? color(theme.onPrimary).alpha(0.2).string()
                  : theme.rippleColor,
              }}
            >
              <AppText
                style={[
                  isActive ? styles.currentPageText : styles.pageText,
                  {
                    color: isActive ? theme.onPrimary : theme.onSurface,
                    fontWeight: isActive ? ('600' as const) : ('400' as const),
                  },
                ]}
                numberOfLines={1}
              >
                {pageName}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[
          styles.pageButton,
          {
            borderColor: borderColor,
            backgroundColor: theme.surface,
          },
          !canGoNext && styles.disabledButton,
        ]}
        onPress={handleNext}
        disabled={!canGoNext}
        android_ripple={{ color: theme.rippleColor }}
      >
        <IconButton
          icon="chevron-right"
          iconColor={canGoNext ? theme.onSurface : theme.onSurfaceDisabled}
          size={iconSize.sm}
          style={styles.iconButton}
        />
      </Pressable>
    </View>
  );
};

export default PagePaginationControl;
