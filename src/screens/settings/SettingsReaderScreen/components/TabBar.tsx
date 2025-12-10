import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  theme: ThemeColors;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  theme,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const iconSize = useMemo(() => scaleDimension(20, uiScale), [uiScale]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 0, 0, 0.12)',
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: scaleDimension(14, uiScale),
          paddingHorizontal: scaleDimension(8, uiScale),
          minHeight: scaleDimension(48, uiScale),
          borderBottomWidth: 2,
        },
      }),
    [uiScale],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const tabStyle = {
          borderBottomColor: isActive ? theme.primary : 'transparent',
        };
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, tabStyle]}
            onPress={() => onTabChange(tab.id)}
            android_ripple={{
              color: theme.rippleColor,
              borderless: false,
            }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={iconSize}
              color={isActive ? theme.primary : theme.onSurfaceVariant}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

export default TabBar;
