import React, { memo, useRef, useState, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
} from 'react-native';

import IconButtonV2 from '../IconButtonV2/IconButtonV2';
import { ThemeColors } from '../../theme/types';
import { Menu } from '@components';
import { MaterialDesignIconName } from '@type/icon';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

export interface RightIcon {
  iconName: MaterialDesignIconName;
  color?: string;
  onPress: () => void;
}

interface MenuButton {
  title: string;
  onPress: () => void;
}

interface SearcbarProps {
  searchText: string;
  placeholder: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  leftIcon: MaterialDesignIconName;
  rightIcons?: readonly RightIcon[];
  menuButtons?: MenuButton[];
  handleBackAction?: () => void;
  clearSearchbar: () => void;
  onLeftIconPress?: () => void;
  theme: ThemeColors;
}

const Searchbar: React.FC<SearcbarProps> = ({
  searchText,
  placeholder,
  onChangeText,
  onSubmitEditing,
  leftIcon,
  rightIcons,
  menuButtons,
  handleBackAction,
  clearSearchbar,
  onLeftIconPress,
  theme,
}) => {
  const searchbarRef = useRef<TextInput>(null);
  const focusSearchbar = () => searchbarRef.current?.focus();
  const [extraMenu, showExtraMenu] = useState(false);
  const { uiScale = 1.0 } = useAppSettings();

  const marginTop = useMemo(() => scaleDimension(8, uiScale), [uiScale]);
  const marginRight = useMemo(() => scaleDimension(16, uiScale), [uiScale]);
  const marginLeft = useMemo(() => scaleDimension(16, uiScale), [uiScale]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        icon: {
          marginHorizontal: scaleDimension(8, uiScale),
        },
        searchIconContainer: {
          borderRadius: 50,
          overflow: 'hidden',
        },
        searchbar: {
          alignItems: 'center',
          flex: 1,
          flexDirection: 'row',
          paddingHorizontal: scaleDimension(8, uiScale),
        },
        searchbarContainer: {
          borderRadius: 50,
          marginBottom: scaleDimension(12, uiScale),
          marginHorizontal: scaleDimension(16, uiScale),
          minHeight: scaleDimension(56, uiScale),
          overflow: 'hidden',
          zIndex: 1,
        },
        textInput: {
          flex: 1,
          fontSize: scaleDimension(16, uiScale),
          marginHorizontal: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  return (
    <View
      style={[
        styles.searchbarContainer,
        {
          marginTop,
          marginRight,
          marginLeft,
          backgroundColor: theme.surface2,
        },
      ]}
    >
      <Pressable
        onPress={focusSearchbar}
        android_ripple={{ color: theme.rippleColor }}
        style={styles.searchbar}
      >
        <IconButtonV2
          name={handleBackAction ? 'arrow-left' : leftIcon}
          color={theme.onSurface}
          onPress={() => {
            if (handleBackAction) {
              handleBackAction();
            } else if (onLeftIconPress) {
              onLeftIconPress();
            }
          }}
          theme={theme}
        />

        <TextInput
          ref={searchbarRef}
          style={[styles.textInput, { color: theme.onSurface }]}
          placeholder={placeholder}
          placeholderTextColor={theme.onSurface}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          defaultValue={searchText}
        />
        {searchText !== '' ? (
          <IconButtonV2
            name="close"
            color={theme.onSurface}
            onPress={clearSearchbar}
            theme={theme}
          />
        ) : null}
        {rightIcons?.map((icon, index) => (
          <IconButtonV2
            key={index}
            name={icon.iconName}
            color={icon.color || theme.onSurface}
            onPress={icon.onPress}
            theme={theme}
          />
        ))}
        {menuButtons?.length ? (
          <Menu
            visible={extraMenu}
            onDismiss={() => showExtraMenu(false)}
            anchor={
              <IconButtonV2
                name="dots-vertical"
                color={theme.onSurface}
                onPress={() => showExtraMenu(true)}
                theme={theme}
              />
            }
            contentStyle={{
              backgroundColor: theme.surface2,
            }}
          >
            {menuButtons?.map((button, index) => (
              <Menu.Item
                key={index}
                title={button.title}
                style={{ backgroundColor: theme.surface2 }}
                titleStyle={
                  {
                    color: theme.onSurface,
                  } as TextStyle
                }
                onPress={() => {
                  showExtraMenu(false);
                  setTimeout(() => {
                    button.onPress();
                  }, 0);
                }}
              />
            ))}
          </Menu>
        ) : null}
      </Pressable>
    </View>
  );
};

export default memo(Searchbar);
