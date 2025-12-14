module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|jest-?|react-native|@react-native|@react-native-community|@react-native-google-signin|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|react-native-background-actions|color|lodash-es)/)',
  ],
  moduleNameMapper: {
    '^expo-localization$': '<rootDir>/__mocks__/expo-localization.js',
    '^i18n-js$': '<rootDir>/__mocks__/i18n-js.js',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    '^expo-linking$': '<rootDir>/__mocks__/expo-linking.js',
    '^expo-web-browser$': '<rootDir>/__mocks__/expo-web-browser.js',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
    '^react-native-background-actions$':
      '<rootDir>/__mocks__/react-native-background-actions.js',
    '^@react-native-google-signin/google-signin$':
      '<rootDir>/__mocks__/@react-native-google-signin/google-signin.js',
    '.*specs/NativeFile$': '<rootDir>/__mocks__/NativeFile.js',
    '.*specs/NativeZipArchive$': '<rootDir>/__mocks__/NativeZipArchive.js',
    '.*specs/NativeEpub$': '<rootDir>/__mocks__/NativeEpub.js',
    '^react-native-mmkv$': '<rootDir>/__mocks__/react-native-mmkv.js',
  },
};
