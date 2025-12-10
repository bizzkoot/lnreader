import React, { ReactNode, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import MaterialIcon from '@react-native-vector-icons/material-design-icons';

import { List as PaperList, Divider as PaperDivider } from 'react-native-paper';
import { ThemeColors } from '../../theme/types';
import { scaleDimension } from '@theme/scaling';
import { useAppSettings } from '@hooks/persisted';

interface ListItemProps {
  title: string;
  description?: string | null;
  icon?: string;
  onPress?: () => void;
  theme: ThemeColors;
  disabled?: boolean;
  right?: string;
}

const Section = ({ children }: { children: ReactNode }) => (
  <PaperList.Section style={styles.listSection}>{children}</PaperList.Section>
);

const SubHeader = ({
  children,
  theme,
}: {
  children: ReactNode;
  theme: ThemeColors;
}) => (
  <PaperList.Subheader style={{ color: theme.primary }}>
    {children}
  </PaperList.Subheader>
);

const Item: React.FC<ListItemProps> = ({
  title,
  description,
  icon,
  onPress,
  theme,
  disabled,
  right,
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const dynamicStyles = useMemo(
    () => ({
      iconCtn: {
        paddingLeft: scaleDimension(16, uiScale),
      },
      listItemCtn: {
        paddingVertical: scaleDimension(12, uiScale),
      },
      description: {
        fontSize: scaleDimension(12, uiScale),
        lineHeight: scaleDimension(20, uiScale),
      },
    }),
    [uiScale],
  );

  const left = useCallback(() => {
    if (icon) {
      return (
        <PaperList.Icon
          color={theme.primary}
          icon={icon}
          style={dynamicStyles.iconCtn}
        />
      );
    }
  }, [icon, theme.primary, dynamicStyles.iconCtn]);

  const rightIcon = useCallback(() => {
    if (right) {
      return (
        <PaperList.Icon
          color={theme.primary}
          icon={right}
          style={dynamicStyles.iconCtn}
        />
      );
    }
  }, [right, theme.primary, dynamicStyles.iconCtn]);

  return (
    <PaperList.Item
      title={title}
      titleStyle={{
        color: disabled ? theme.onSurfaceDisabled : theme.onSurface,
      }}
      description={description}
      descriptionStyle={[
        dynamicStyles.description,
        {
          color: disabled ? theme.onSurfaceDisabled : theme.onSurfaceVariant,
        },
      ]}
      left={left}
      right={rightIcon}
      disabled={disabled}
      onPress={onPress}
      rippleColor={theme.rippleColor}
      style={dynamicStyles.listItemCtn}
    />
  );
};

const Divider = ({ theme }: { theme: ThemeColors }) => (
  <PaperDivider style={[styles.divider, { backgroundColor: theme.outline }]} />
);

const InfoItem = ({
  title,
  theme,
  style,
}: {
  title: string;
  icon?: string;
  theme: ThemeColors;
  style?: StyleProp<ViewStyle>;
}) => {
  const { uiScale = 1.0 } = useAppSettings();

  const dynamicStyles = useMemo(
    () => ({
      infoCtn: {
        paddingHorizontal: scaleDimension(16, uiScale),
        paddingVertical: scaleDimension(12, uiScale),
      },
      infoMsg: {
        fontSize: scaleDimension(12, uiScale),
        marginTop: scaleDimension(12, uiScale),
      },
    }),
    [uiScale],
  );

  return (
    <View style={[dynamicStyles.infoCtn, style]}>
      <MaterialIcon
        size={scaleDimension(20, uiScale)}
        color={theme.onSurfaceVariant}
        name={'information-outline'}
      />
      <Text style={[dynamicStyles.infoMsg, { color: theme.onSurfaceVariant }]}>
        {title}
      </Text>
    </View>
  );
};

const Icon = ({ icon, theme }: { icon: string; theme: ThemeColors }) => (
  <PaperList.Icon color={theme.primary} icon={icon} style={styles.margin0} />
);

interface ColorItemProps {
  title: string;
  description: string;
  theme: ThemeColors;
  onPress: () => void;
}

const ColorItem = ({ title, description, theme, onPress }: ColorItemProps) => {
  const { uiScale = 1.0 } = useAppSettings();

  const dynamicStyles = useMemo(
    () => ({
      pressable: {
        padding: scaleDimension(16, uiScale),
      },
      fontSize16: {
        fontSize: scaleDimension(16, uiScale),
      },
      descriptionView: {
        height: scaleDimension(24, uiScale),
        width: scaleDimension(24, uiScale),
        borderRadius: scaleDimension(50, uiScale),
        marginRight: scaleDimension(16, uiScale),
      },
    }),
    [uiScale],
  );

  return (
    <Pressable
      style={[styles.pressable, dynamicStyles.pressable]}
      android_ripple={{ color: theme.rippleColor }}
      onPress={onPress}
    >
      <View>
        <Text style={[{ color: theme.onSurface }, dynamicStyles.fontSize16]}>
          {title}
        </Text>
        <Text style={{ color: theme.onSurfaceVariant }}>{description}</Text>
      </View>
      <View
        style={[
          {
            backgroundColor: description,
          },
          dynamicStyles.descriptionView,
        ]}
      />
    </Pressable>
  );
};

export default {
  Section,
  SubHeader,
  Item,
  Divider,
  InfoItem,
  Icon,
  ColorItem,
};

const styles = StyleSheet.create({
  margin0: { margin: 0 },
  divider: {
    height: 1,
    opacity: 0.5,
  },
  listSection: {
    flex: 1,
    marginVertical: 0,
  },
  pressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
