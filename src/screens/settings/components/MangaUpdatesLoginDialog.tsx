import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Modal } from '@components';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

interface MangaUpdatesLoginDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
}

const MangaUpdatesLoginDialog: React.FC<MangaUpdatesLoginDialogProps> = ({
  visible,
  onDismiss,
  onSubmit,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          padding: scaleDimension(8, uiScale),
        },
        title: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(24, uiScale),
          fontWeight: '500',
        },
        input: {
          height: scaleDimension(48, uiScale),
          borderWidth: 1,
          borderRadius: scaleDimension(4, uiScale),
          paddingHorizontal: scaleDimension(16, uiScale),
          marginBottom: scaleDimension(16, uiScale),
          fontSize: scaleDimension(16, uiScale),
        },
        errorText: {
          fontSize: scaleDimension(14, uiScale),
          marginBottom: scaleDimension(16, uiScale),
          marginTop: scaleDimension(-8, uiScale),
        },
        buttonRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: scaleDimension(8, uiScale),
        },
        button: {
          marginLeft: scaleDimension(8, uiScale),
        },
        buttonLabel: {
          letterSpacing: 0,
          textTransform: 'none',
        },
      }),
    [uiScale],
  );

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSubmit(username.trim(), password);
      // Clear form on success
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setUsername('');
    setPassword('');
    setError('');
    onDismiss();
  };

  return (
    <Modal visible={visible} onDismiss={handleCancel}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.onSurface }]}>
          Login to MangaUpdates
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.onSurface,
              borderColor: theme.outline,
            },
          ]}
          placeholder="Username"
          placeholderTextColor={theme.onSurfaceVariant}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.onSurface,
              borderColor: theme.outline,
            },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.onSurfaceVariant}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Button
            style={styles.button}
            labelStyle={[{ color: theme.primary }, styles.buttonLabel]}
            onPress={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            style={styles.button}
            labelStyle={[{ color: theme.primary }, styles.buttonLabel]}
            onPress={handleSubmit}
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default MangaUpdatesLoginDialog;
