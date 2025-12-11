import { useMemo } from 'react';
import { useAppSettings } from '@hooks/persisted';
import { getScaledDimensions } from '@theme/scaling';

/**
 * Hook that provides scaled dimensions based on the user's UI scale setting.
 * This ensures consistent UI scaling throughout the app.
 * @returns Object with scaled dimensions for common UI elements
 */
export const useScaledDimensions = () => {
  const { uiScale = 1.0 } = useAppSettings();

  return useMemo(() => getScaledDimensions(uiScale), [uiScale]);
};
