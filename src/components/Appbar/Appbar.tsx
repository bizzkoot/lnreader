import React from 'react';

import { Appbar as PaperAppbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../../theme/types';

interface AppbarProps {
  title: string;
  handleGoBack?: () => void;
  theme: ThemeColors;
  mode?: 'small' | 'medium' | 'large' | 'center-aligned';
  children?: React.ReactNode;
}

const Appbar: React.FC<AppbarProps> = ({
  title,
  handleGoBack,
  theme,
  mode = 'small',
  children,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <PaperAppbar.Header
      style={{ backgroundColor: theme.surface }}
      statusBarHeight={insets.top}
      mode={mode}
    >
      {handleGoBack && (
        <PaperAppbar.BackAction
          onPress={handleGoBack}
          iconColor={theme.onSurface}
        />
      )}
      <PaperAppbar.Content
        title={title}
        titleStyle={{ color: theme.onSurface }}
      />
      {children}
    </PaperAppbar.Header>
  );
};

export default Appbar;
