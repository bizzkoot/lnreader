import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import color from 'color';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import Animated, {
  Easing,
  ReduceMotion,
  withTiming,
} from 'react-native-reanimated';

import { ThemeColors } from '@theme/types';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import { getString } from '@strings/translations';
import { ReaderSearchResult } from '../types';

const fastOutSlowIn = Easing.bezier(0.4, 0.0, 0.2, 1.0);

const MIN_QUERY_LENGTH = 3;

interface ReaderSearchbarProps {
  theme: ThemeColors;
  searchResult: ReaderSearchResult;
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

const ReaderSearchbar = ({
  theme,
  searchResult,
  onSearch,
  onNext,
  onPrevious,
  onClose,
}: ReaderSearchbarProps) => {
  const scaledDimensions = useScaledDimensions();
  const { uiScale = 1.0 } = useAppSettings();
  const statusBarHeight = StatusBar.currentHeight ?? 0;

  const entering = () => {
    'worklet';
    return {
      initialValues: { originY: -statusBarHeight, opacity: 0 },
      animations: {
        originY: withTiming(0, {
          duration: 250,
          easing: fastOutSlowIn,
          reduceMotion: ReduceMotion.System,
        }),
        opacity: withTiming(1, { duration: 150 }),
      },
    };
  };
  const exiting = () => {
    'worklet';
    return {
      initialValues: { originY: 0, opacity: 1 },
      animations: {
        originY: withTiming(-statusBarHeight, {
          duration: 250,
          easing: fastOutSlowIn,
          reduceMotion: ReduceMotion.System,
        }),
        opacity: withTiming(0, { duration: 150 }),
      },
    };
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          top: 0,
          width: '100%',
          zIndex: 2,
          backgroundColor: color(theme.surface).alpha(0.95).string(),
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: scaledDimensions.padding.sm,
          paddingTop: statusBarHeight + scaledDimensions.padding.xs,
          paddingBottom: scaledDimensions.padding.sm,
        },
        input: {
          flex: 1,
          height: scaledDimensions.buttonHeight.md,
          backgroundColor: theme.surfaceVariant,
          borderRadius: scaledDimensions.borderRadius.md,
          paddingHorizontal: scaledDimensions.padding.md,
          color: theme.onSurface,
          fontSize: scaleDimension(16, uiScale),
        },
        button: {
          paddingHorizontal: scaledDimensions.padding.xs,
          paddingVertical: scaledDimensions.padding.xs,
          justifyContent: 'center',
          alignItems: 'center',
        },
        counter: {
          color: theme.onSurfaceVariant,
          fontSize: scaleDimension(13, uiScale),
          minWidth: scaleDimension(32, uiScale),
          textAlign: 'center',
          marginHorizontal: 2,
        },
        truncatedCounter: {
          color: theme.onSurfaceVariant,
          fontSize: scaleDimension(11, uiScale),
          minWidth: 0,
          textAlign: 'center',
          marginHorizontal: 2,
        },
      }),
    [theme, scaledDimensions, uiScale, statusBarHeight],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const [inputValue, setInputValue] = useState(searchResult.query);
  useEffect(() => {
    // Sync from parent only when not actively typing (no pending debounce) or on clear
    if (searchResult.query === '' || !debounceRef.current) {
      if (searchResult.query !== inputValue) setInputValue(searchResult.query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchResult.query]);

  const handleTextChange = useCallback((text: string) => {
    setInputValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchRef.current(text), 150);
  }, []);

  const handleClearInput = useCallback(() => {
    setInputValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearchRef.current('');
  }, []);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const { current, total, renderedTotal, isTruncated } = searchResult;
  const effectiveQuery = inputValue;
  const hasResults = total > 0;
  const hasQuery = effectiveQuery.length > 0;
  const tooShort =
    hasQuery &&
    effectiveQuery.length < MIN_QUERY_LENGTH &&
    !/[^\p{L}\p{N}\s]/u.test(effectiveQuery);

  // Truncation: WebView caps highlights at MAX_RENDERED_MATCHES (1500). Show
  // "current/rendered+" so user knows more matches exist unhighlighted.
  const counterText = hasResults
    ? isTruncated
      ? `${current}/${renderedTotal}+`
      : `${current}/${total}`
    : `0/0`;

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={styles.container}
    >
      <Pressable
        style={styles.button}
        onPress={handleClose}
        accessibilityLabel={getString('readerScreen.search.closeSearch')}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={scaledDimensions.iconSize.md}
          color={theme.onSurface}
        />
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder={getString('readerScreen.searchPlaceholder')}
        placeholderTextColor={theme.onSurfaceVariant}
        value={inputValue}
        onChangeText={handleTextChange}
        onSubmitEditing={() => {
          if (hasResults) onNext();
        }}
        returnKeyType="search"
        autoFocus
        selectionColor={theme.primary}
      />
      {inputValue.length > 0 && (
        <Pressable
          style={styles.button}
          onPress={handleClearInput}
          accessibilityLabel={getString('readerScreen.search.clearSearch')}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="close"
            size={scaledDimensions.iconSize.md - 2}
            color={theme.onSurfaceVariant}
          />
        </Pressable>
      )}
      {hasQuery && !tooShort && (
        <>
          <Pressable
            style={styles.button}
            onPress={onPrevious}
            disabled={!hasResults || current <= 1}
            accessibilityLabel={getString('readerScreen.search.previousMatch')}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="chevron-up"
              size={scaledDimensions.iconSize.md}
              color={
                !hasResults || current <= 1
                  ? theme.onSurfaceVariant
                  : theme.onSurface
              }
            />
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={onNext}
            disabled={!hasResults || current >= total}
            accessibilityLabel={getString('readerScreen.search.nextMatch')}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={scaledDimensions.iconSize.md}
              color={
                !hasResults || current >= total
                  ? theme.onSurfaceVariant
                  : theme.onSurface
              }
            />
          </Pressable>
          <Text
            style={[styles.counter, { color: theme.onSurfaceVariant }]}
            accessibilityLabel={`Match ${counterText}`}
          >
            {counterText}
          </Text>
        </>
      )}
      {tooShort && (
        <Text style={[styles.counter, { color: theme.onSurfaceVariant }]}>
          {getString('readerScreen.searchMinLength', {
            count: MIN_QUERY_LENGTH,
          })}
        </Text>
      )}
      {isTruncated && hasResults && (
        <Text style={styles.truncatedCounter}>
          {getString('readerScreen.search.totalMatches', { count: total })}
        </Text>
      )}
    </Animated.View>
  );
};

export default ReaderSearchbar;
