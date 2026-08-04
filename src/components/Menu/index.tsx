import { useTheme, useAppSettings } from '@hooks/persisted';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutRectangle,
  Modal as NativeModal,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

const HORIZONTAL_MARGIN = 16;
const VERTICAL_MARGIN = 8;
const ANCHOR_GAP = 4;
const MAX_MENU_WIDTH = 280;
const MAX_MENU_HEIGHT_RATIO = 0.6;
const ENTER_DURATION = 150;
const EXIT_DURATION = 75;

interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  fullWidth?: boolean; // Full width of the anchor
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}

const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  contentStyle,
  children,
  fullWidth,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const anchorRef = useRef<View>(null);

  const [menuLayout, setMenuLayout] = useState<LayoutRectangle | null>(null);
  const [anchorLayout, setAnchorLayout] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const scaled = useMemo(
    () => ({
      horizontalMargin: scaleDimension(HORIZONTAL_MARGIN, uiScale),
      verticalMargin: scaleDimension(VERTICAL_MARGIN, uiScale),
      anchorGap: scaleDimension(ANCHOR_GAP, uiScale),
      maxMenuWidth: scaleDimension(MAX_MENU_WIDTH, uiScale),
    }),
    [uiScale],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modal: {
          flex: 1,
        },
        menuContainer: {
          borderCurve: 'continuous',
          borderRadius: scaleDimension(4, uiScale),
          elevation: 2,
          minWidth: scaleDimension(112, uiScale),
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.2,
          shadowRadius: 3,
          overflow: 'hidden',
          position: 'absolute',
          zIndex: 1,
        },
        menuContent: {
          paddingVertical: scaleDimension(8, uiScale),
        },
      }),
    [uiScale],
  );

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorLayout({ x, y, width, height });
    });
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      measureAnchor();
    }
  }, [measureAnchor, screenHeight, screenWidth, visible]);

  const menuPosition = useMemo(() => {
    if (!menuLayout) return { opacity: 0 };
    const leftPos = Math.max(
      scaled.horizontalMargin,
      Math.min(
        anchorLayout.x,
        screenWidth - menuLayout.width - scaled.horizontalMargin,
      ),
    );

    let topPos = anchorLayout.y + anchorLayout.height + scaled.anchorGap;

    const showAbove =
      topPos + menuLayout.height > screenHeight - scaled.verticalMargin;
    if (showAbove) {
      topPos = anchorLayout.y - menuLayout.height - scaled.anchorGap;
    }
    topPos = Math.max(
      scaled.verticalMargin,
      Math.min(
        topPos,
        screenHeight - menuLayout.height - scaled.verticalMargin,
      ),
    );

    const maxWidth = fullWidth
      ? anchorLayout.width
      : Math.min(
          scaled.maxMenuWidth,
          screenWidth - scaled.horizontalMargin * 2,
        );

    return {
      left: leftPos,
      top: topPos,
      shadowColor: theme.isDark ? '#000' : theme.shadow,
      [fullWidth ? 'width' : 'maxWidth']: maxWidth,
    };
  }, [
    anchorLayout.height,
    anchorLayout.width,
    anchorLayout.x,
    anchorLayout.y,
    fullWidth,
    menuLayout,
    screenHeight,
    screenWidth,
    scaled,
    theme.isDark,
    theme.shadow,
  ]);

  return (
    <>
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
        {anchor}
      </View>

      {visible && (
        <NativeModal
          animationType="none"
          hardwareAccelerated
          navigationBarTranslucent
          onRequestClose={onDismiss}
          onShow={measureAnchor}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          transparent
          visible
        >
          <View style={styles.modal}>
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={onDismiss}
              style={StyleSheet.absoluteFill}
              testID="menu-backdrop"
            />
            <Animated.View
              accessibilityRole="menu"
              accessibilityViewIsModal
              entering={
                menuLayout ? FadeIn.duration(ENTER_DURATION) : undefined
              }
              exiting={menuLayout ? FadeOut.duration(EXIT_DURATION) : undefined}
              key={menuLayout ? 'ready' : 'measuring'}
              onLayout={event => setMenuLayout(event.nativeEvent.layout)}
              style={[
                styles.menuContainer,
                {
                  backgroundColor:
                    theme.surfaceContainerLow ??
                    theme.surface2 ??
                    theme.surface,
                },
                contentStyle,
                menuPosition,
              ]}
              testID="menu"
            >
              <ScrollView
                contentContainerStyle={styles.menuContent}
                style={{ maxHeight: screenHeight * MAX_MENU_HEIGHT_RATIO }}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </View>
        </NativeModal>
      )}
    </>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({
  title,
  onPress,
  style,
  titleStyle,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        menuItem: {
          paddingHorizontal: scaleDimension(12, uiScale),
          paddingVertical: scaleDimension(8, uiScale),
          minHeight: scaleDimension(48, uiScale),
          justifyContent: 'center',
        },
        menuItemText: {
          fontSize: 14,
          fontWeight: '500',
          letterSpacing: 0.1,
          lineHeight: 20,
        },
      }),
    [uiScale],
  );

  return (
    <Pressable
      accessibilityRole="menuitem"
      style={[styles.menuItem, style]}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor, foreground: true }}
    >
      <AppText
        style={[
          styles.menuItemText,
          {
            color: theme.onSurface,
          },
          titleStyle,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
};

Menu.Item = MenuItem;

export default Menu;
