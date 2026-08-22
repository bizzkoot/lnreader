import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import color from 'color';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { ThemeColors } from '@theme/types';
import { useScaledDimensions } from '@hooks/useScaledDimensions';
import { getString } from '@strings/translations';
import { ReaderSearchResult } from '../types';

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: color(theme.surface).alpha(0.95).string(),
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: scaledDimensions.padding.sm,
          paddingVertical: scaledDimensions.padding.xs,
        },
        input: {
          flex: 1,
          height: scaledDimensions.buttonHeight.md,
          backgroundColor: theme.surfaceVariant,
          borderRadius: scaledDimensions.borderRadius.md,
          paddingHorizontal: scaledDimensions.padding.md,
          color: theme.onSurface,
          fontSize: 16,
        },
        button: {
          paddingHorizontal: scaledDimensions.padding.xs,
          paddingVertical: scaledDimensions.padding.xs,
          justifyContent: 'center',
          alignItems: 'center',
        },
        counter: {
          color: theme.onSurfaceVariant,
          fontSize: 13,
          minWidth: 32,
          textAlign: 'center',
          marginHorizontal: 2,
        },
      }),
    [theme, scaledDimensions],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  const handleTextChange = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchRef.current(text), 150);
  }, []);

  const { query, current, total } = searchResult;
  const hasResults = total > 0;
  const hasQuery = query.length > 0;
  const tooShort =
    hasQuery &&
    query.length < MIN_QUERY_LENGTH &&
    !/[^\p{L}\p{N}\s]/u.test(query);

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={onClose}>
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
        value={query}
        onChangeText={handleTextChange}
        onSubmitEditing={() => onNext()}
        returnKeyType="search"
        autoFocus
        selectionColor={theme.primary}
      />
      {hasResults && (
        <>
          <Pressable
            style={styles.button}
            onPress={onPrevious}
            disabled={current <= 1}
          >
            <MaterialCommunityIcons
              name="chevron-up"
              size={scaledDimensions.iconSize.md}
              color={current <= 1 ? theme.onSurfaceVariant : theme.onSurface}
            />
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={onNext}
            disabled={current >= total}
          >
            <MaterialCommunityIcons
              name="chevron-down"
              size={scaledDimensions.iconSize.md}
              color={
                current >= total ? theme.onSurfaceVariant : theme.onSurface
              }
            />
          </Pressable>
          <Text style={[styles.counter, { color: theme.onSurfaceVariant }]}>
            {`${current}/${total}`}
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
    </View>
  );
};

export default ReaderSearchbar;
