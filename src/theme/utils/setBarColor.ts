import { StatusBar } from 'react-native';
import { ThemeColors } from '@theme/types';
import * as NavigationBar from 'expo-navigation-bar';
import Color from 'color';

export const setStatusBarColor = (color: ThemeColors | Color) => {
  if (color instanceof Color) {
    // fullscreen reader mode
    StatusBar.setBarStyle(color.isDark() ? 'light-content' : 'dark-content');
    StatusBar.setBackgroundColor(color.hexa());
  } else {
    StatusBar.setTranslucent(true);
    StatusBar.setBackgroundColor('transparent');
    StatusBar.setBarStyle(color.isDark ? 'light-content' : 'dark-content');
  }
};

/**
 * Sets the navigation-bar BUTTON style only.
 *
 * The nav-bar BACKGROUND is intentionally left to the system: setting it here
 * was disabled upstream (commit 1ac6d116a, "Fix: Reader footer position &
 * system bar", PR #1076) because a custom background broke the reader footer
 * layout, and it is ignored/ineffective under Android 12+/API 35 edge-to-edge
 * anyway. Restoring `NavigationBar.setBackgroundColorAsync` would risk
 * regressing that fix for no user-visible benefit.
 */
export const changeNavigationBarColor = (color: string, isDark = false) => {
  NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
};
