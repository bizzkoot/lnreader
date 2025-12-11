import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { Button, Modal, SwitchItem } from '@components/index';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { scaleDimension } from '@theme/scaling';
import { Storage } from '@plugins/helpers/storage';
import AppText from '@components/AppText';

interface PluginSetting {
  value: string;
  label: string;
  type?: 'Switch';
}

interface PluginSettings {
  [key: string]: PluginSetting;
}

interface SourceSettingsModal {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  description?: string;
  pluginId: string;
  pluginSettings?: PluginSettings;
}

const SourceSettingsModal: React.FC<SourceSettingsModal> = ({
  onDismiss,
  visible,
  title,
  description,
  pluginId,
  pluginSettings,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          flex: 1,
          marginHorizontal: scaleDimension(8, uiScale),
          marginTop: scaleDimension(16, uiScale),
        },
        customCSSButtons: {
          flexDirection: 'row',
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(16, uiScale),
        },
        textInput: {
          borderRadius: scaleDimension(14, uiScale),
          fontSize: scaleDimension(16, uiScale),
          height: scaleDimension(50, uiScale),
          marginBottom: scaleDimension(8, uiScale),
          marginTop: scaleDimension(16, uiScale),
        },
      }),
    [uiScale],
  );

  const [formValues, setFormValues] = useState<
    Record<string, string | boolean>
  >({});

  useEffect(() => {
    if (pluginSettings) {
      const storage = new Storage(pluginId);

      const loadFormValues = async () => {
        const loadedValues = await Promise.all(
          Object.keys(pluginSettings).map(async key => {
            const storedValue = await storage.get(key);
            return {
              key,
              value:
                storedValue !== null ? storedValue : pluginSettings[key].value,
            };
          }),
        );

        const initialFormValues = Object.fromEntries(
          loadedValues.map(({ key, value }) => [key, value]),
        );

        setFormValues(initialFormValues);
      };

      loadFormValues();
    }
  }, [pluginSettings, pluginId]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormValues(prevValues => ({
      ...prevValues,
      [key]: value,
    }));
  };

  const handleSave = () => {
    const storage = new Storage(pluginId);
    Object.entries(formValues).forEach(([key, value]) => {
      storage.set(key, value);
    });
    onDismiss();
  };

  if (!pluginSettings || Object.keys(pluginSettings).length === 0) {
    return (
      <Modal visible={visible} onDismiss={onDismiss}>
        <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
          {title}
        </AppText>
        <AppText style={{ color: theme.onSurfaceVariant }}>
          {description || 'No settings available.'}
        </AppText>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
        {title}
      </AppText>
      <AppText style={{ color: theme.onSurfaceVariant }}>{description}</AppText>
      {Object.entries(pluginSettings).map(([key, setting]) => {
        if (setting?.type === 'Switch') {
          return (
            <SwitchItem
              key={key}
              value={!!formValues[key]}
              label={setting.label}
              onPress={() => handleChange(key, !formValues[key])}
              theme={theme}
            />
          );
        }
        return (
          <TextInput
            key={key}
            mode="outlined"
            label={setting.label}
            value={(formValues[key] ?? '') as string}
            onChangeText={value => handleChange(key, value)}
            placeholder={`Enter ${setting.label}`}
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
          />
        );
      })}
      <View style={styles.customCSSButtons}>
        <Button
          onPress={handleSave}
          style={styles.button}
          title={getString('common.save')}
          mode="contained"
        />
      </View>
    </Modal>
  );
};

export default SourceSettingsModal;
