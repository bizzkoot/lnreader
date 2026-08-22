import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  TabBar,
  TabBarIndicator,
  type Route,
  type TabBarProps,
} from 'react-native-tab-view';

const TopTabBar = <T extends Route>({
  indicatorStyle,
  ...props
}: TabBarProps<T>) => (
  <TabBar
    {...props}
    renderIndicator={indicatorProps => (
      <TabBarIndicator {...indicatorProps} style={styles.indicatorWrapper}>
        <View style={[styles.primaryIndicator, indicatorStyle]} />
      </TabBarIndicator>
    )}
  />
);

const styles = StyleSheet.create({
  indicatorWrapper: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
    start: 0,
  },
  primaryIndicator: {
    width: '60%',
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});

export default TopTabBar;
