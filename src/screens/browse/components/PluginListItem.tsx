import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Image, View, StyleSheet } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { usePlugins, useAppSettings } from '@hooks/persisted';
import { PluginItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { BrowseScreenProps } from '@navigators/types';
import { Button, IconButtonV2 } from '@components';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { showToast } from '@utils/showToast';
import { UseBooleanReturnType } from '@hooks';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import AppText from '@components/AppText';

interface PluginListItemProps {
  item: PluginItem;
  theme: ThemeColors;
  navigation: BrowseScreenProps['navigation'];
  settingsModal: UseBooleanReturnType;
  navigateToSource: (plugin: PluginItem, showLatestNovels?: boolean) => void;
  setSelectedPluginId: React.Dispatch<React.SetStateAction<string>>;
}

export const PluginListItem = memo(
  ({
    item,
    theme,
    navigation,
    settingsModal,
    navigateToSource,
    setSelectedPluginId,
  }: PluginListItemProps) => {
    const { uninstallPlugin, updatePlugin, togglePinPlugin, isPinned } =
      usePlugins();

    const { uiScale = 1.0 } = useAppSettings();
    const { iconSize } = useScaledDimensions();
    const styles = useMemo(() => createStyles(uiScale), [uiScale]);

    const isPluginPinned = isPinned(item.id);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const rightActionStyle = useMemo(
      () => [styles.buttonGroup, { backgroundColor: theme.primary }],
      [theme.primary, styles],
    );
    const containerStyle = useMemo(
      () => [styles.container, { backgroundColor: theme.surface }],
      [theme.surface, styles],
    );
    const iconStyle = useMemo(
      () => [styles.icon, { backgroundColor: theme.surface }],
      [theme.surface, styles],
    );
    const nameStyle = useMemo(
      () => [{ color: theme.onSurface }, styles.name],
      [theme.onSurface, styles],
    );
    const additionStyle = useMemo(
      () => [{ color: theme.onSurfaceVariant }, styles.addition],
      [theme.onSurfaceVariant, styles],
    );

    const handleWebviewPress = useCallback(
      (ref: { close: () => void }) => {
        ref.close();
        navigation.navigate('WebviewScreen', {
          name: item.name,
          url: item.site,
          pluginId: item.id,
        });
      },
      [navigation, item],
    );

    const handlePinPress = useCallback(
      (ref: { close: () => void }) => {
        ref.close();
        togglePinPlugin(item.id);
        showToast(
          isPluginPinned
            ? getString('browseScreen.unpinnedPlugin', { name: item.name })
            : getString('browseScreen.pinnedPlugin', { name: item.name }),
        );
      },
      [togglePinPlugin, item.id, item.name, isPluginPinned],
    );

    const handleDeletePress = useCallback((ref: { close: () => void }) => {
      ref.close();
      setShowDeleteDialog(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
      uninstallPlugin(item).then(() =>
        showToast(
          getString('browseScreen.uninstalledPlugin', {
            name: item.name,
          }),
        ),
      );
    }, [uninstallPlugin, item]);

    const handleSettingsPress = useCallback(() => {
      setSelectedPluginId(item.id);
      settingsModal.setTrue();
    }, [setSelectedPluginId, item.id, settingsModal]);

    const handleUpdatePress = useCallback(() => {
      updatePlugin(item)
        .then(version =>
          showToast(getString('browseScreen.updatedTo', { version })),
        )
        .catch((error: Error) => showToast(error.message));
    }, [updatePlugin, item]);

    const handleLatestPress = useCallback(() => {
      navigateToSource(item, true);
    }, [navigateToSource, item]);

    const handlePress = useCallback(() => {
      navigateToSource(item);
    }, [navigateToSource, item]);

    const renderRightActions = useCallback(
      (_progress: unknown, _dragX: unknown, ref: { close: () => void }) => (
        <View style={styles.rightActionsContainer}>
          <View style={rightActionStyle}>
            <IconButtonV2
              name="earth"
              size={iconSize.sm}
              color={theme.onPrimary}
              onPress={() => handleWebviewPress(ref)}
              theme={theme}
            />
          </View>
          <View style={rightActionStyle}>
            <IconButtonV2
              name={isPluginPinned ? 'pin-off' : 'pin'}
              size={iconSize.sm}
              color={theme.onPrimary}
              onPress={() => handlePinPress(ref)}
              theme={theme}
            />
          </View>
          <View style={[rightActionStyle]}>
            <IconButtonV2
              name="delete"
              size={iconSize.sm}
              color={theme.onPrimary}
              onPress={() => handleDeletePress(ref)}
              theme={theme}
            />
          </View>
        </View>
      ),
      [
        handleWebviewPress,
        handlePinPress,
        handleDeletePress,
        iconSize.sm,
        isPluginPinned,
        rightActionStyle,
        styles.rightActionsContainer,
        theme,
      ],
    );

    return (
      <>
        <Swipeable
          dragOffsetFromLeftEdge={30}
          dragOffsetFromRightEdge={30}
          renderRightActions={renderRightActions}
        >
          <Pressable
            style={containerStyle}
            android_ripple={{ color: theme.rippleColor }}
            onPress={handlePress}
          >
            <View style={[styles.center, styles.row]}>
              <Image source={{ uri: item.iconUrl }} style={iconStyle} />
              <View style={styles.details}>
                <AppText numberOfLines={1} style={nameStyle}>
                  {item.name}
                </AppText>
                <AppText numberOfLines={1} style={additionStyle}>
                  {`${item.lang} - ${item.version}`}
                </AppText>
              </View>
            </View>
            <View style={styles.flex} />
            {item.hasUpdate || __DEV__ ? (
              <IconButtonV2
                name="download-outline"
                size={iconSize.sm}
                color={theme.primary}
                onPress={handleUpdatePress}
                theme={theme}
              />
            ) : null}
            {item.hasSettings ? (
              <IconButtonV2
                name="cog-outline"
                size={iconSize.sm}
                color={theme.primary}
                onPress={handleSettingsPress}
                theme={theme}
              />
            ) : null}
            <Button
              title={getString('browseScreen.latest')}
              textColor={theme.primary}
              onPress={handleLatestPress}
            />
          </Pressable>
        </Swipeable>
        <ConfirmationDialog
          visible={showDeleteDialog}
          title={getString('common.delete')}
          message={getString('browseScreen.deletePluginMessage', {
            name: item.name,
          })}
          onSubmit={handleConfirmDelete}
          onDismiss={() => setShowDeleteDialog(false)}
          theme={theme}
        />
      </>
    );
  },
);

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    addition: {
      fontSize: scaleDimension(12, uiScale),
      lineHeight: scaleDimension(20, uiScale),
    },
    buttonGroup: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 8,
    },
    center: { alignItems: 'center' },
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    details: {
      marginLeft: 16,
    },
    flex: { flex: 1 },
    icon: {
      borderRadius: 4,
      height: scaleDimension(40, uiScale),
      width: scaleDimension(40, uiScale),
    },
    name: {
      lineHeight: 20,
    },
    pinnedIndicator: {
      marginRight: -8,
    },
    rightActionsContainer: {
      flexDirection: 'row',
    },
    row: {
      flexDirection: 'row',
    },
  });
