// Mock react-native-reanimated (ESM) — provide light stub for Animated.View etc.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');
  const View = RN.View;
  const MockedView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }),
  );
  return {
    __esModule: true,
    default: { View: MockedView },
    Easing: { bezier: () => () => ({}) },
    ReduceMotion: { System: 0 },
    withTiming: v => v,
  };
});

// Mock all native modules and problematic ESM dependencies globally

// Mock react-native-device-info
jest.mock('react-native-device-info', () => ({
  getDeviceUserAgentSync: jest.fn(() => 'Mozilla/5.0 (test)'),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '14.0'),
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getUniqueId: jest.fn(() => 'test-id'),
  getDeviceId: jest.fn(() => 'test-device'),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
  useRoute: jest.fn(() => ({ params: {} })),
  useIsFocused: jest.fn(() => true),
}));

// Mock other native specs if needed
jest.mock('../specs/NativeFile', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({ ExternalDirectoryPath: '/mock/path' }),
  },
}));

// Provide a light DevMenu TurboModule mock to satisfy react-native internals
// Note: Nightly/CI can mock required TurboModules in tests instead of globally.
// Keep global setup minimal to avoid masking native integration issues.
