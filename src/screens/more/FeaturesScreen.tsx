import { useTheme, useAppSettings } from '@hooks/persisted';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppText from '@components/AppText';
import { Appbar, SafeAreaView } from '@components';
import { Portal, Dialog, Button, TouchableRipple } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { scaleDimension } from '@theme/scaling';
import { useMemo, useState } from 'react';

type FeatureItem = {
  icon: string;
  title: string;
  desc: string;
  location?: string;
  detailedGuide?: string[];
};

type FeatureSection = {
  title: string;
  items: FeatureItem[];
};

const FEATURES: FeatureSection[] = [
  {
    title: 'Advanced TTS Engine',
    items: [
      {
        icon: 'bluetooth-audio',
        title: 'Bluetooth & Media Controls',
        desc: 'Fully supports headset buttons (Play/Pause) and custom media notification. Playback continues reliably in background with silent audio focus.',
        location: 'Works automatically',
        detailedGuide: [
          'Connect your Bluetooth headset.',
          'Start TTS playback in the app.',
          "Use your headset's Play/Pause button to control playback.",
        ],
      },
      {
        icon: 'timer-stop-outline',
        title: 'Auto-Stop System',
        desc: 'Smart timer that detects screen state. Use "Sleep Timer" or "Auto pause on screen off".',
        location: 'Reader Bottom Sheet → TTS Tab',
        detailedGuide: [
          'Open any novel chapter.',
          'Tap the center of the screen to show the menu.',
          'Tap the "TTS" tab (headset icon).',
          'Scroll down to the "Timer" section.',
          'Set "Sleep Timer" or enable "Auto pause on screen off".',
        ],
      },
      {
        icon: 'tune-vertical',
        title: 'Per-Novel Settings',
        desc: 'Customize TTS voice, speed, and pitch specifically for each novel. Settings are auto-saved.',
        location: 'Reader Bottom Sheet → TTS Tab',
        detailedGuide: [
          'Open the novel you want to customize.',
          'Tap text center -> "TTS" tab.',
          'Adjust Rate, Pitch, or Voice.',
          'These settings are automatically saved for *this* novel only.',
          'Global defaults apply to all other novels.',
        ],
      },
      {
        icon: 'account-voice',
        title: 'Unified Voice Manager',
        desc: 'Voices are sorted by language with clear "Network" vs "Local" badges.',
        location: 'Reader Bottom Sheet → TTS Tab',
        detailedGuide: [
          'Tap text center -> "TTS" tab.',
          'Tap "Voice" to open the picker.',
          'Voices are language-sorted.',
          'Look for "Network" (Online) or "Local" badges.',
        ],
      },
    ],
  },
  {
    title: 'Immersive Reading',
    items: [
      {
        icon: 'script-text-outline',
        title: 'Continuous Scrolling',
        desc: 'Seamlessly scroll from one chapter to the next without interruption. "Invisible" chapter transitions.',
        location: 'Reader Settings → General',
        detailedGuide: [
          'Open Reader Settings (Cog icon in bottom menu).',
          'Go to "General" tab.',
          'Ensure you are using Vertical or Webtoon reading mode.',
          'Seamless transition happens automatically between chapters.',
        ],
      },
      {
        icon: 'resize',
        title: 'Dynamic UI Scaling',
        desc: 'Adjust the size of the entire interface (buttons, text, icons) to fit your preference.',
        location: 'Initial Setup / Settings → Appearance',
        detailedGuide: [
          'Go to "More" tab -> Settings.',
          'Tap "Appearance".',
          'Adjust "UI Info Scale" slider.',
        ],
      },
      {
        icon: 'check-all',
        title: 'Auto-Mark & Download',
        desc: 'Automatically mark short chapters (e.g., author notes) as read and auto-download next chapters while reading.',
        location: 'Reader Settings → General',
        detailedGuide: [
          'Open Reader Settings (Cog icon).',
          'Go to "General" tab.',
          'Enable "Auto-download next chapter".',
        ],
      },
    ],
  },
  {
    title: 'Data Freedom',
    items: [
      {
        icon: 'cloud-upload-outline',
        title: 'Advanced Backup',
        desc: 'Support for "Repository" backups and Legacy (v2.0.3) compatibility for easy migration.',
        location: 'Settings → Backup',
        detailedGuide: [
          'Go to "More" tab -> Settings.',
          'Tap "Backup".',
          'Use "Create Backup" for standard backup.',
        ],
      },
      {
        icon: 'calendar-clock',
        title: 'Automatic Backups',
        desc: 'Scheduled background backups to keep your library safe. Auto-prunes old backups.',
        location: 'Settings → Backup',
        detailedGuide: [
          'Go to "More" tab -> Settings.',
          'Tap "Backup".',
          'Enable "Automatic Backups".',
          'Set "Backup Frequency" and "Max Backups".',
        ],
      },
    ],
  },
  {
    title: 'System Enhancements',
    items: [
      {
        icon: 'monitor-cellphone',
        title: 'Hybrid Updates',
        desc: 'Update the app directly from the "About" screen with verified GitHub assets.',
        location: 'More → About',
        detailedGuide: [
          'Go to "More" tab -> "About".',
          'Tap "Check for updates".',
        ],
      },
      {
        icon: 'battery-charging-high',
        title: 'Performance',
        desc: 'Optimized battery usage with proper Wake Locks and memory management.',
        location: 'Under the hood',
        detailedGuide: [
          'Updates are applied automatically.',
          'Enjoy smoother performance and better battery life!',
        ],
      },
    ],
  },
];

const FeatureItemView = ({
  item,
  theme,
  uiScale,
  styles,
  onPress,
}: {
  item: FeatureItem;
  theme: any;
  uiScale: number;
  styles: any;
  onPress: (item: FeatureItem) => void;
}) => (
  <TouchableRipple
    onPress={() => onPress(item)}
    style={styles.touchable}
    rippleColor={theme.rippleColor}
  >
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={scaleDimension(28, uiScale)}
          color={theme.primary}
        />
      </View>
      <View style={styles.featureContent}>
        <AppText style={styles.featureTitle}>{item.title}</AppText>
        <AppText style={styles.featureDesc}>{item.desc}</AppText>
        {item.location && (
          <View style={styles.locationContainer}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={scaleDimension(14, uiScale)}
              color={theme.onSurfaceVariant}
            />
            <AppText style={styles.locationText}>{item.location}</AppText>
          </View>
        )}
      </View>
    </View>
  </TouchableRipple>
);

const FeaturesScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = useMemo(() => createStyles(uiScale, theme), [uiScale, theme]);

  const [selectedFeature, setSelectedFeature] = useState<FeatureItem | null>(
    null,
  );

  const showGuide = (item: FeatureItem) => setSelectedFeature(item);
  const hideGuide = () => setSelectedFeature(null);

  return (
    <SafeAreaView style={[{ backgroundColor: theme.background }, styles.root]}>
      <Appbar
        title="App Features"
        handleGoBack={() => navigation.goBack()}
        mode="small"
        theme={theme}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="star-face"
            size={scaleDimension(60, uiScale)}
            color={theme.primary}
            style={styles.logo}
          />
          <AppText style={[{ color: theme.onBackground }, styles.headline]}>
            Features in This Fork
          </AppText>
          <AppText style={[{ color: theme.onSurfaceVariant }, styles.subhead]}>
            Explore the powerful features added to enhance your reading
            experience. Tap any item for details.
          </AppText>
        </View>

        {FEATURES.map((section, index) => (
          <View
            key={index}
            style={[styles.section, { backgroundColor: theme.surface }]}
          >
            <AppText style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {section.title}
            </AppText>
            {section.items.map((item, i) => (
              <FeatureItemView
                key={i}
                item={item}
                theme={theme}
                uiScale={uiScale}
                styles={styles}
                onPress={showGuide}
              />
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <AppText style={styles.footerText}>
            Thank you for using this custom build!
          </AppText>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={!!selectedFeature}
          onDismiss={hideGuide}
          style={{ backgroundColor: theme.surface }}
        >
          <Dialog.Title style={{ color: theme.onSurface }}>
            {selectedFeature?.title}
          </Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.guideScroll}>
              {selectedFeature?.detailedGuide?.map((step, index) => (
                <View key={index} style={styles.guideStep}>
                  <AppText
                    style={[styles.guideStepNumber, { color: theme.primary }]}
                  >
                    {index + 1}.
                  </AppText>
                  <AppText
                    style={[
                      styles.guideStepText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    {step}
                  </AppText>
                </View>
              ))}
              {!selectedFeature?.detailedGuide && (
                <AppText style={{ color: theme.onSurfaceVariant }}>
                  {selectedFeature?.desc}
                </AppText>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideGuide} labelStyle={{ color: theme.primary }}>
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const createStyles = (uiScale: number, theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 24,
    },
    logo: {
      marginBottom: 12,
    },
    headline: {
      fontSize: scaleDimension(24, uiScale),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    subhead: {
      fontSize: scaleDimension(14, uiScale),
      textAlign: 'center',
      lineHeight: scaleDimension(20, uiScale),
      paddingHorizontal: 20,
    },
    section: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: scaleDimension(18, uiScale),
      fontWeight: '700',
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.outline,
      paddingBottom: 8,
    },
    featureItem: {
      flexDirection: 'row',
      marginBottom: 20,
      alignItems: 'center',
    },
    featureIconContainer: {
      width: scaleDimension(40, uiScale),
      alignItems: 'center',
    },
    featureContent: {
      flex: 1,
      paddingLeft: 8,
    },
    featureTitle: {
      fontSize: scaleDimension(16, uiScale),
      fontWeight: '600',
      color: theme.onSurface,
      marginBottom: 4,
    },
    featureDesc: {
      fontSize: scaleDimension(13, uiScale),
      color: theme.onSurfaceVariant,
      lineHeight: scaleDimension(18, uiScale),
      marginBottom: 6,
    },
    locationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    locationText: {
      fontSize: scaleDimension(11, uiScale),
      color: theme.onSurfaceVariant,
      marginLeft: 4,
      fontWeight: '500',
    },
    footer: {
      marginTop: 16,
      marginBottom: 32,
    },
    footerText: {
      color: theme.onSurfaceVariant,
      fontSize: scaleDimension(12, uiScale),
      textAlign: 'center',
    },
    guideStep: {
      flexDirection: 'row',
      marginBottom: 12,
      paddingRight: 8,
    },
    guideStepNumber: {
      fontSize: scaleDimension(14, uiScale),
      fontWeight: 'bold',
      marginRight: 8,
      width: 20,
    },
    guideStepText: {
      fontSize: scaleDimension(14, uiScale),
      flex: 1,
      lineHeight: scaleDimension(20, uiScale),
    },
    touchable: {
      borderRadius: 8,
    },
    guideScroll: {
      maxHeight: 300,
    },
  });

export default FeaturesScreen;
