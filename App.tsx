import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

// Disable font scaling globally to prevent double scaling with system font settings
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.allowFontScaling = false;

import React, { useEffect, useMemo } from 'react';
import { Text, TextInput, StatusBar, StyleSheet } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieSplashScreen from 'react-native-lottie-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Provider as PaperProvider,
  MD3DarkTheme,
  MD3LightTheme,
} from 'react-native-paper';
import * as Notifications from 'expo-notifications';

import AppErrorBoundary, {
  ErrorFallback,
} from '@components/AppErrorBoundary/AppErrorBoundary';
import { useDatabaseInitialization } from '@hooks';
import {
  useAppSettings,
  useTheme,
  useAutoBackup,
  ThemeProvider,
} from '@hooks/persisted';
import { getScaledFonts } from '@theme/fonts';

import Main from './src/navigators/Main';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import CloudflareWebView from '@components/CloudflareWebView';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

Notifications.setNotificationCategoryAsync('TTS_CONTROLS', [
  {
    identifier: 'TTS_PLAY_PAUSE',
    buttonTitle: '▶️ Play',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'TTS_STOP',
    buttonTitle: '⏹️ Stop',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'TTS_NEXT',
    buttonTitle: '⏭️ Next',
    options: {
      opensAppToForeground: false,
    },
  },
]);

Notifications.setNotificationChannelAsync('tts-controls', {
  name: 'TTS Controls',
  description: 'Text-to-Speech playback controls',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [],
  enableLights: false,
  enableVibrate: false,
});

const App = () => {
  const { isDbReady, dbError, retryInitialization } =
    useDatabaseInitialization();

  useEffect(() => {
    if (isDbReady || dbError) {
      LottieSplashScreen.hide();
    }
  }, [isDbReady, dbError]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const actionIdentifier = response.actionIdentifier;
        if (actionIdentifier.startsWith('TTS_')) {
          const { setTTSAction } = require('@utils/ttsNotification');
          setTTSAction(actionIdentifier);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  if (dbError) {
    return (
      <ThemeProvider>
        <ErrorFallbackPaperProvider>
          <ErrorFallback error={dbError} resetError={retryInitialization} />
        </ErrorFallbackPaperProvider>
      </ThemeProvider>
    );
  }

  if (!isDbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ThemeProvider>
        <AppErrorBoundary>
          <SafeAreaProvider>
            <ThemedPaperProvider>
              <BottomSheetModalProvider>
                <StatusBar translucent={true} backgroundColor="transparent" />
                <CloudflareWebView enabled={true} />
                <Main />
              </BottomSheetModalProvider>
            </ThemedPaperProvider>
          </SafeAreaProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

/**
 * Builds the react-native-paper theme from the app theme + uiScale.
 * Pure function (no hooks, no side effects) so it can also be used on the
 * dbError path where DB-dependent hooks must not run.
 */
const buildPaperTheme = (
  appTheme: ReturnType<typeof useTheme>,
  uiScale: number,
) => {
  const baseTheme = appTheme.isDark ? MD3DarkTheme : MD3LightTheme;
  const scaledFonts = getScaledFonts(uiScale);

  return {
    ...baseTheme,
    fonts: scaledFonts,
    colors: {
      ...baseTheme.colors,
      primary: appTheme.primary,
      onPrimary: appTheme.onPrimary,
      primaryContainer: appTheme.primaryContainer,
      onPrimaryContainer: appTheme.onPrimaryContainer,
      secondary: appTheme.secondary,
      onSecondary: appTheme.onSecondary,
      secondaryContainer: appTheme.secondaryContainer,
      onSecondaryContainer: appTheme.onSecondaryContainer,
      tertiary: appTheme.tertiary,
      onTertiary: appTheme.onTertiary,
      tertiaryContainer: appTheme.tertiaryContainer,
      onTertiaryContainer: appTheme.onTertiaryContainer,
      error: appTheme.error,
      onError: appTheme.onError,
      errorContainer: appTheme.errorContainer,
      onErrorContainer: appTheme.onErrorContainer,
      background: appTheme.background,
      onBackground: appTheme.onBackground,
      surface: appTheme.surface,
      onSurface: appTheme.onSurface,
      surfaceVariant: appTheme.surfaceVariant,
      onSurfaceVariant: appTheme.onSurfaceVariant,
      outline: appTheme.outline,
      outlineVariant: appTheme.outlineVariant,
      inverseSurface: appTheme.inverseSurface,
      inverseOnSurface: appTheme.inverseOnSurface,
      inversePrimary: appTheme.inversePrimary,
    },
  };
};

/**
 * ThemedPaperProvider - Wraps PaperProvider with scaled fonts based on uiScale setting.
 * This is a separate component because hooks can only be used after DB initialization.
 */
const ThemedPaperProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { uiScale = 1.0 } = useAppSettings();
  const appTheme = useTheme();
  const { checkAndTriggerBackup } = useAutoBackup();

  // Check for automatic backup on app launch
  useEffect(() => {
    checkAndTriggerBackup();
  }, [checkAndTriggerBackup]);

  const paperTheme = useMemo(
    () => buildPaperTheme(appTheme, uiScale),
    [appTheme, uiScale],
  );

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};

/**
 * ErrorFallbackPaperProvider - PaperProvider for the pre-DB error screen.
 * Uses the SAME scaled/full-color theme as the main tree via buildPaperTheme,
 * but deliberately does NOT run ThemedPaperProvider's auto-backup hook (which
 * triggers ServiceManager backup flows and must only mount after DB init).
 * Hooks used here (useAppSettings/useTheme) are MMKV/context-only and safe
 * before DB initialization — ErrorFallback itself already uses them.
 */
const ErrorFallbackPaperProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { uiScale = 1.0 } = useAppSettings();
  const appTheme = useTheme();

  const paperTheme = useMemo(
    () => buildPaperTheme(appTheme, uiScale),
    [appTheme, uiScale],
  );

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};

export default App;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
