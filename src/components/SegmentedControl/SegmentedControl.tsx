import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  theme: ThemeColors;
  showCheckIcon?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  theme,
  showCheckIcon = true,
}: SegmentedControlProps<T>) {
  const { uiScale = 1.0 } = useAppSettings();

  const iconSize = useMemo(() => scaleDimension(18, uiScale), [uiScale]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          height: scaleDimension(48, uiScale),
        },
        segment: {
          flex: 1,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          overflow: 'hidden',
        },
        segmentFirst: {
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderTopLeftRadius: scaleDimension(24, uiScale),
          borderBottomLeftRadius: scaleDimension(24, uiScale),
        },
        segmentMiddle: {
          borderRightWidth: 1,
        },
        segmentLast: {
          borderRightWidth: 1,
          borderTopRightRadius: scaleDimension(24, uiScale),
          borderBottomRightRadius: scaleDimension(24, uiScale),
        },
        segmentPressable: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: scaleDimension(12, uiScale),
          paddingVertical: scaleDimension(10, uiScale),
        },
        segmentText: {
          fontSize: scaleDimension(14, uiScale),
          fontWeight: '500',
          letterSpacing: 0.1,
        },
        checkIcon: {
          marginRight: scaleDimension(8, uiScale),
        },
        icon: {
          marginRight: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        const buttonStyles = [
          styles.segment,
          isFirst && styles.segmentFirst,
          isLast && styles.segmentLast,
          !isFirst && !isLast && styles.segmentMiddle,
          {
            backgroundColor: isSelected
              ? theme.secondaryContainer
              : 'transparent',
            borderColor: theme.outline,
          },
        ];

        const textColor = isSelected
          ? theme.onSecondaryContainer
          : theme.onSurface;

        return (
          <View key={option.value} style={buttonStyles}>
            <Pressable
              style={styles.segmentPressable}
              onPress={() => onChange(option.value)}
              android_ripple={{
                color: theme.rippleColor,
                borderless: false,
              }}
            >
              {showCheckIcon && isSelected && (
                <MaterialCommunityIcons
                  name="check"
                  size={iconSize}
                  color={textColor}
                  style={styles.checkIcon}
                />
              )}
              {option.icon && !isSelected && (
                <MaterialCommunityIcons
                  name={option.icon}
                  size={iconSize}
                  color={textColor}
                  style={styles.icon}
                />
              )}
              <Text style={[styles.segmentText, { color: textColor }]}>
                {option.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
