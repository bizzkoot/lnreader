export const getMaterial3Theme = jest.fn(() => ({ light: {}, dark: {} }));
// Real module exports a plain boolean (`!!ExpoMaterial3ThemeModule && Platform.OS === 'android' && Platform.Version >= 31`).
// Keeping this a jest.fn would be truthy and make isDynamicThemeAvailable take the dynamic branch in tests.
export const isDynamicThemeSupported = false;
