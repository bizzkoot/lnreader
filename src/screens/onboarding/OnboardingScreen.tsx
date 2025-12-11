import { useTheme, useAppSettings } from '@hooks/persisted';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, StyleSheet, View } from 'react-native';
import { Button } from '@components';
import ThemeSelectionStep from './ThemeSelectionStep';
import { useState } from 'react';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { getString } from '@strings/translations';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';

enum OnboardingStep {
  PICK_THEME,
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const [step] = useState<OnboardingStep>(OnboardingStep.PICK_THEME);

  const renderStep = () => {
    switch (step) {
      case OnboardingStep.PICK_THEME:
        return <ThemeSelectionStep />;
      default:
        return <ThemeSelectionStep />;
    }
  };
  const renderHelptext = () => {
    switch (step) {
      case OnboardingStep.PICK_THEME:
        return getString('onboardingScreen.pickATheme');
      default:
        return getString('onboardingScreen.pickATheme');
    }
  };

  return (
    <SafeAreaView
      style={[{ backgroundColor: theme.background }, styles(uiScale).root]}
    >
      <Image
        source={require('../../../assets/logo.png')}
        tintColor={theme.primary}
        style={styles(uiScale).logo}
      />
      <AppText
        style={[{ color: theme.onBackground }, styles(uiScale).headline]}
      >
        {getString('onboardingScreen.welcome')}
      </AppText>
      <AppText
        style={[{ color: theme.onBackground }, styles(uiScale).helpText]}
      >
        {renderHelptext()}
      </AppText>
      <View
        style={[
          { backgroundColor: theme.surfaceVariant },
          styles(uiScale).stepContainer,
        ]}
      >
        {renderStep()}
      </View>

      <Button
        title={getString('onboardingScreen.complete')}
        mode="contained"
        onPress={() => {
          MMKVStorage.set('IS_ONBOARDED', true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = (uiScale: number) =>
  StyleSheet.create({
    root: {
      height: '100%',
      paddingBottom: 16,
      paddingHorizontal: 16,
      paddingTop: 40,
    },
    logo: {
      width: scaleDimension(90, uiScale),
      height: scaleDimension(90, uiScale),
    },
    headline: {
      fontWeight: 500,
      paddingBottom: 8,
    },
    helpText: {
      fontWeight: 500,
      paddingBottom: 8,
    },
    stepContainer: {
      borderRadius: 8,
      flexBasis: '20%',
      flexGrow: 1,
      marginBottom: 16,
      paddingTop: 16,
      position: 'relative',
    },
  });
