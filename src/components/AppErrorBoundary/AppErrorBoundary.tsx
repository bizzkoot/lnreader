import React, { useMemo } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { Text } from '@components/AppText';
import ErrorBoundary from 'react-native-error-boundary';

import { Button, List } from '@components';
import { useTheme } from '@hooks/persisted';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSettings } from '@hooks/persisted/useSettings';
import { scaleDimension } from '@theme/scaling';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        buttonCtn: {
          margin: scaleDimension(16, uiScale),
          marginBottom: scaleDimension(32, uiScale),
        },
        errorCtn: {
          borderRadius: scaleDimension(8, uiScale),
          lineHeight: scaleDimension(20, uiScale),
          marginVertical: scaleDimension(16, uiScale),
          paddingHorizontal: scaleDimension(8, uiScale),
          paddingVertical: scaleDimension(16, uiScale),
        },
        errorDesc: {
          lineHeight: scaleDimension(20, uiScale),
          marginVertical: scaleDimension(8, uiScale),
        },
        errorInfoCtn: {
          flex: 1,
          justifyContent: 'center',
          padding: scaleDimension(16, uiScale),
        },
        errorTitle: {
          fontSize: scaleDimension(20, uiScale),
          marginBottom: scaleDimension(8, uiScale),
          textAlign: 'center',
        },
        mainCtn: {
          flex: 1,
        },
      }),
    [uiScale],
  );

  return (
    <SafeAreaView
      style={[styles.mainCtn, { backgroundColor: theme.background }]}
    >
      <StatusBar translucent={true} backgroundColor="transparent" />
      <View style={styles.errorInfoCtn}>
        <Text style={[styles.errorTitle, { color: theme.onSurface }]}>
          An Unexpected Error Ocurred
        </Text>
        <Text style={[styles.errorDesc, { color: theme.onSurface }]}>
          The application ran into an unexpected error. We suggest you
          screenshot this message and then share it in our support channel on
          Discord.
        </Text>
        <Text
          style={[
            styles.errorCtn,
            {
              backgroundColor: theme.surfaceVariant,
              color: theme.onSurfaceVariant,
            },
          ]}
          numberOfLines={20}
        >
          {`${error.message}\n\n${error.stack}`}
        </Text>
      </View>
      <List.Divider theme={theme} />
      <Button
        onPress={resetError}
        title={'Restart the application'}
        style={styles.buttonCtn}
        mode="contained"
      />
    </SafeAreaView>
  );
};

interface AppErrorBoundaryProps {
  children: React.ReactElement;
}

const AppErrorBoundary: React.FC<AppErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
  );
};

export default AppErrorBoundary;
