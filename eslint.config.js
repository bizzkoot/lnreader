import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNativePlugin from 'eslint-plugin-react-native';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-native': reactNativePlugin,
    },
    rules: {
      'no-shadow': 'off',
      'no-undef': 'off',
      'no-console': 'error',
      '@typescript-eslint/no-shadow': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'curly': ['error', 'multi-line', 'consistent'],
      'no-useless-return': 'error',
      'block-scoped-var': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-imports': 'error',
      'react-native/no-inline-styles': 'warn',
    },
  },
];