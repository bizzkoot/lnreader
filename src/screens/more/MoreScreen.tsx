import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Pressable, Text, ScrollView } from 'react-native';
import { getString } from '@strings/translations';

import { List, SafeAreaView } from '@components';

import { MoreHeader } from './components/MoreHeader';
import { useLibrarySettings, useTheme, useAppSettings } from '@hooks/persisted';
import { MoreStackScreenProps } from '@navigators/types';
import Switch from '@components/Switch/Switch';
import { useMMKVObject } from 'react-native-mmkv';
import ServiceManager, { BackgroundTask } from '@services/ServiceManager';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { scaleDimension } from '@theme/scaling';

const MoreScreen = ({ navigation }: MoreStackScreenProps) => {
  const theme = useTheme();
  const { iconSize } = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();

  const [taskQueue] = useMMKVObject<BackgroundTask[]>(
    ServiceManager.manager.STORE_KEY,
  );
  const {
    incognitoMode = false,
    downloadedOnlyMode = false,
    setLibrarySettings,
  } = useLibrarySettings();

  const dynamicStyles = useMemo(
    () => ({
      description: {
        fontSize: scaleDimension(12, uiScale),
        lineHeight: scaleDimension(20, uiScale),
      },
      pressable: {
        paddingHorizontal: scaleDimension(16, uiScale),
        paddingVertical: scaleDimension(14, uiScale),
      },
      fontSize16: { fontSize: scaleDimension(16, uiScale) },
      marginLeft16: { marginLeft: scaleDimension(16, uiScale) },
    }),
    [uiScale],
  );

  const enableDownloadedOnlyMode = () =>
    setLibrarySettings({ downloadedOnlyMode: !downloadedOnlyMode });

  const enableIncognitoMode = () =>
    setLibrarySettings({ incognitoMode: !incognitoMode });

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          navigation.navigate('MoreStack', {
            screen: 'SettingsStack',
            params: {
              screen: 'Settings',
            },
          });
        }
      }),
    [navigation],
  );

  return (
    <SafeAreaView excludeTop excludeBottom>
      <ScrollView>
        <MoreHeader
          // status bar is translucent, text could be mess with it
          title={''}
          navigation={navigation}
          theme={theme}
        />
        <List.Section>
          <Pressable
            android_ripple={{ color: theme.rippleColor }}
            style={[styles.pressable, dynamicStyles.pressable]}
            onPress={enableDownloadedOnlyMode}
          >
            <View style={styles.row}>
              <List.Icon theme={theme} icon="cloud-off-outline" />
              <View style={dynamicStyles.marginLeft16}>
                <Text
                  style={[
                    {
                      color: theme.onSurface,
                    },
                    dynamicStyles.fontSize16,
                  ]}
                >
                  {getString('moreScreen.downloadOnly')}
                </Text>
                <Text
                  style={[
                    dynamicStyles.description,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {getString('moreScreen.downloadOnlyDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={downloadedOnlyMode}
              onValueChange={enableDownloadedOnlyMode}
              size={iconSize.md}
            />
          </Pressable>
          <Pressable
            android_ripple={{ color: theme.rippleColor }}
            style={[styles.pressable, dynamicStyles.pressable]}
            onPress={enableIncognitoMode}
          >
            <View style={styles.row}>
              <List.Icon theme={theme} icon="glasses" />
              <View style={dynamicStyles.marginLeft16}>
                <Text
                  style={[
                    {
                      color: theme.onSurface,
                    },
                    dynamicStyles.fontSize16,
                  ]}
                >
                  {getString('moreScreen.incognitoMode')}
                </Text>
                <Text
                  style={[
                    dynamicStyles.description,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {getString('moreScreen.incognitoModeDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={incognitoMode}
              onValueChange={enableIncognitoMode}
              size={iconSize.md}
            />
          </Pressable>
          <List.Divider theme={theme} />
          <List.Item
            title={'Task Queue'}
            description={
              taskQueue && taskQueue.length > 0
                ? taskQueue.length + ' remaining'
                : ''
            }
            icon="progress-download"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'TaskQueue',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.downloads')}
            icon="folder-download"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Downloads',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.categories')}
            icon="label-outline"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Categories',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('statsScreen.title')}
            icon="chart-line"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Statistics',
              })
            }
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.Item
            title={getString('common.settings')}
            icon="cog-outline"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'SettingsStack',
                params: {
                  screen: 'Settings',
                },
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.about')}
            icon="information-outline"
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'About',
              })
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MoreScreen;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  pressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
