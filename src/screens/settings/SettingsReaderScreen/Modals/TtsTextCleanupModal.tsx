import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Share } from 'react-native';
import { Portal, TextInput } from 'react-native-paper';
import Modal from '@components/Modal/Modal';
import List from '@components/List/List';
import Switch from '@components/Switch/Switch';
import AppText from '@components/AppText';
import Button from '@components/Button/Button';
import { IconButtonV2 } from '@components/index';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import {
  TtsTextCleanupSettings,
  TtsCleanupRule,
  TtsPhoneticPair,
  createTtsCleanupRule,
  createTtsPhoneticPair,
  TTS_CLEANUP_MAX_REGEX_LENGTH,
  isPotentiallyCatastrophic,
  normalizeRegExpFlags,
} from '@utils/htmlParagraphExtractor';
import {
  TTS_CLEANUP_PRESETS,
  TtsCleanupPreset,
  applyPresetToSettings,
  parseCleanupSettingsImport,
  serializeCleanupSettings,
} from './ttsCleanupPresets';

interface TtsTextCleanupModalProps {
  visible: boolean;
  onDismiss: () => void;
  settings: TtsTextCleanupSettings;
  onSave: (settings: TtsTextCleanupSettings) => void;
}

type EditorMode = 'list' | 'rule' | 'pair';

interface RuleFormState {
  id?: string;
  pattern: string;
  replacement: string;
  isRegex: boolean;
  flags: string;
}

interface PairFormState {
  id?: string;
  word: string;
  pronunciation: string;
  matchMode: 'whole-word' | 'substring';
}

const EMPTY_RULE_FORM: RuleFormState = {
  pattern: '',
  replacement: '',
  isRegex: false,
  flags: 'g',
};

const EMPTY_PAIR_FORM: PairFormState = {
  word: '',
  pronunciation: '',
  matchMode: 'whole-word',
};

/** Validate a rule form; returns an error string or null when valid. */
const validateRuleForm = (form: RuleFormState): string | null => {
  if (!form.pattern.trim()) {
    return 'Pattern is required.';
  }
  if (!form.isRegex) {
    return null;
  }
  const pattern = form.pattern.trim();
  if (pattern.length > TTS_CLEANUP_MAX_REGEX_LENGTH) {
    return `Regex is too long (max ${TTS_CLEANUP_MAX_REGEX_LENGTH} chars).`;
  }
  if (isPotentiallyCatastrophic(pattern)) {
    return 'Pattern looks unsafe and may freeze playback (e.g. nested quantifiers like (a+)+). Simplify it.';
  }
  try {
    // Compile-check the pattern + flags exactly as the runtime will apply it.
    new RegExp(pattern, normalizeRegExpFlags(form.flags));
  } catch {
    return 'Invalid regex pattern or flags.';
  }
  return null;
};

const formatRuleSummary = (rule: TtsCleanupRule): string => {
  const find = rule.isRegex
    ? `/${rule.pattern}/${rule.flags}`
    : `"${rule.pattern}"`;
  const replace = rule.replacement === '' ? '(strip)' : `"${rule.replacement}"`;
  return `${find} → ${replace}`;
};

const formatPairSummary = (pair: TtsPhoneticPair): string =>
  `"${pair.word}" → "${pair.pronunciation}"`;

/**
 * Coerce possibly-partial stored settings (e.g. MMKV written by an older or
 * interrupted version missing `rules`/`phoneticPairs`) into a fully-shaped
 * object so every draft access below can assume the arrays exist.
 */
const normalizeSettings = (
  settings: TtsTextCleanupSettings,
): TtsTextCleanupSettings => ({
  enabled: !!settings.enabled,
  normalizeUnicode: !!settings.normalizeUnicode,
  rules: settings.rules ?? [],
  phoneticPairs: settings.phoneticPairs ?? [],
});

const TtsTextCleanupModal: React.FC<TtsTextCleanupModalProps> = ({
  visible,
  onDismiss,
  settings,
  onSave,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const [draft, setDraft] = useState<TtsTextCleanupSettings>(() =>
    normalizeSettings(settings),
  );
  const [mode, setMode] = useState<EditorMode>('list');
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [pairForm, setPairForm] = useState<PairFormState>(EMPTY_PAIR_FORM);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);

  // Re-sync draft whenever the modal opens or settings change externally.
  useEffect(() => {
    if (visible) {
      setDraft(normalizeSettings(settings));
      setMode('list');
      setRuleForm(EMPTY_RULE_FORM);
      setPairForm(EMPTY_PAIR_FORM);
      setRuleFormError(null);
      setImportVisible(false);
      setImportText('');
      setImportFeedback(null);
    }
  }, [visible, settings]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        containerStyle: {
          maxHeight: Math.round(Dimensions.get('window').height * 0.75),
        },
        content: {
          paddingBottom: scaleDimension(16, uiScale),
        },
        section: {
          marginTop: scaleDimension(16, uiScale),
        },
        masterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: scaleDimension(8, uiScale),
        },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: scaleDimension(6, uiScale),
        },
        toggleLabel: {
          flex: 1,
          paddingRight: scaleDimension(12, uiScale),
        },
        hint: {
          fontSize: scaleDimension(12, uiScale),
          marginTop: 2,
        },
        ruleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: scaleDimension(4, uiScale),
          gap: scaleDimension(4, uiScale),
        },
        ruleText: {
          flex: 1,
          fontSize: scaleDimension(13, uiScale),
        },
        form: {
          marginTop: scaleDimension(12, uiScale),
        },
        formField: {
          marginBottom: scaleDimension(8, uiScale),
          backgroundColor: theme.surface2,
        },
        formActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: scaleDimension(8, uiScale),
          marginTop: scaleDimension(8, uiScale),
        },
        emptyText: {
          paddingVertical: scaleDimension(8, uiScale),
        },
        formError: {
          fontSize: scaleDimension(12, uiScale),
          marginBottom: scaleDimension(8, uiScale),
        },
        feedbackText: {
          fontSize: scaleDimension(12, uiScale),
          marginTop: scaleDimension(6, uiScale),
        },
        presetRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: scaleDimension(8, uiScale),
          paddingVertical: scaleDimension(6, uiScale),
        },
        shareRow: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          gap: scaleDimension(4, uiScale),
          marginTop: scaleDimension(8, uiScale),
        },
        addButtonContainer: {
          marginTop: scaleDimension(8, uiScale),
        },
      }),
    [uiScale, theme.surface2],
  );

  const inputProps = {
    mode: 'flat' as const,
    autoCorrect: false,
    autoCapitalize: 'none' as const,
    spellCheck: false,
    activeUnderlineColor: theme.primary,
    textColor: theme.onSurface,
    placeholderTextColor: theme.onSurfaceVariant,
  };

  const updateRule = (id: string, patch: Partial<TtsCleanupRule>) => {
    setDraft(d => ({
      ...d,
      rules: d.rules.map(r => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeRule = (id: string) => {
    setDraft(d => ({ ...d, rules: d.rules.filter(r => r.id !== id) }));
  };

  const updatePair = (id: string, patch: Partial<TtsPhoneticPair>) => {
    setDraft(d => ({
      ...d,
      phoneticPairs: d.phoneticPairs.map(p =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  };

  const moveRule = (id: string, dir: -1 | 1) => {
    setDraft(d => {
      const idx = d.rules.findIndex(r => r.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= d.rules.length) {
        return d;
      }
      const rules = [...d.rules];
      [rules[idx], rules[target]] = [rules[target], rules[idx]];
      return { ...d, rules };
    });
  };

  const movePair = (id: string, dir: -1 | 1) => {
    setDraft(d => {
      const idx = d.phoneticPairs.findIndex(p => p.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= d.phoneticPairs.length) {
        return d;
      }
      const phoneticPairs = [...d.phoneticPairs];
      [phoneticPairs[idx], phoneticPairs[target]] = [
        phoneticPairs[target],
        phoneticPairs[idx],
      ];
      return { ...d, phoneticPairs };
    });
  };

  const removePair = (id: string) => {
    setDraft(d => ({
      ...d,
      phoneticPairs: d.phoneticPairs.filter(p => p.id !== id),
    }));
  };

  const saveRule = () => {
    const validationError = validateRuleForm(ruleForm);
    if (validationError) {
      setRuleFormError(validationError);
      return;
    }
    setRuleFormError(null);
    setDraft(d => {
      if (ruleForm.id) {
        return {
          ...d,
          rules: d.rules.map(r =>
            r.id === ruleForm.id
              ? {
                  ...r,
                  pattern: ruleForm.pattern.trim(),
                  replacement: ruleForm.replacement,
                  isRegex: ruleForm.isRegex,
                  flags: ruleForm.isRegex
                    ? normalizeRegExpFlags(ruleForm.flags)
                    : ruleForm.flags,
                }
              : r,
          ),
        };
      }
      return {
        ...d,
        rules: [
          ...d.rules,
          createTtsCleanupRule(
            ruleForm.pattern.trim(),
            ruleForm.replacement,
            ruleForm.isRegex,
            ruleForm.isRegex
              ? normalizeRegExpFlags(ruleForm.flags)
              : ruleForm.flags,
          ),
        ],
      };
    });
    setMode('list');
    setRuleForm(EMPTY_RULE_FORM);
  };

  const savePair = () => {
    if (!pairForm.word.trim()) {
      return;
    }
    setDraft(d => {
      if (pairForm.id) {
        return {
          ...d,
          phoneticPairs: d.phoneticPairs.map(p =>
            p.id === pairForm.id
              ? {
                  ...p,
                  word: pairForm.word.trim(),
                  pronunciation: pairForm.pronunciation,
                  matchMode: pairForm.matchMode,
                }
              : p,
          ),
        };
      }
      return {
        ...d,
        phoneticPairs: [
          ...d.phoneticPairs,
          createTtsPhoneticPair(
            pairForm.word.trim(),
            pairForm.pronunciation,
            true,
            pairForm.matchMode,
          ),
        ],
      };
    });
    setMode('list');
    setPairForm(EMPTY_PAIR_FORM);
  };

  const handleApplyPreset = (preset: TtsCleanupPreset) => {
    setDraft(d => applyPresetToSettings(d, preset));
  };

  const handleExport = () => {
    Share.share({ message: serializeCleanupSettings(draft) }).catch(() => {
      // User dismissed the share sheet — nothing to do.
    });
  };

  const handleImport = () => {
    const result = parseCleanupSettingsImport(importText, draft);
    if (result.ok) {
      setDraft(result.settings);
      setImportFeedback({ kind: 'success', message: result.summary });
      setImportText('');
    } else {
      setImportFeedback({ kind: 'error', message: result.error });
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.containerStyle}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.masterRow}>
              <View style={styles.toggleLabel}>
                <AppText style={{ color: theme.onSurface }}>
                  Clean TTS text
                </AppText>
                <AppText
                  style={[styles.hint, { color: theme.onSurfaceVariant }]}
                >
                  Applied to every paragraph before it reaches the TTS engine
                </AppText>
              </View>
              <Switch
                value={draft.enabled}
                onValueChange={() =>
                  setDraft(d => ({ ...d, enabled: !d.enabled }))
                }
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                <AppText style={{ color: theme.onSurface }}>
                  Unicode normalization
                </AppText>
                <AppText
                  style={[styles.hint, { color: theme.onSurfaceVariant }]}
                >
                  NFD normalize + strip combining marks
                </AppText>
              </View>
              <Switch
                value={draft.normalizeUnicode}
                onValueChange={() =>
                  setDraft(d => ({
                    ...d,
                    normalizeUnicode: !d.normalizeUnicode,
                  }))
                }
              />
            </View>

            {/* Import / Export */}
            <View style={styles.shareRow}>
              <Button
                title="Export JSON"
                mode="text"
                compact
                onPress={handleExport}
              />
              <Button
                title={importVisible ? 'Hide import' : 'Import JSON'}
                mode="text"
                compact
                onPress={() => setImportVisible(v => !v)}
              />
            </View>
            {importVisible && (
              <View style={styles.form}>
                <AppText
                  style={[styles.hint, { color: theme.onSurfaceVariant }]}
                >
                  Paste a TTS Text Cleanup JSON export. Import replaces the
                  current rules &amp; phonetic pairs (draft only — Cancel
                  discards).
                </AppText>
                <TextInput
                  {...inputProps}
                  label="JSON"
                  multiline
                  numberOfLines={5}
                  value={importText}
                  onChangeText={setImportText}
                  style={styles.formField}
                />
                <View style={styles.formActions}>
                  <Button
                    title="Import"
                    mode="contained"
                    onPress={handleImport}
                  />
                </View>
                {importFeedback && (
                  <AppText
                    style={[
                      importFeedback.kind === 'error'
                        ? styles.formError
                        : styles.feedbackText,
                      {
                        color:
                          importFeedback.kind === 'error'
                            ? theme.error
                            : theme.primary,
                      },
                    ]}
                  >
                    {importFeedback.message}
                  </AppText>
                )}
              </View>
            )}

            {mode === 'list' && (
              <View style={styles.section}>
                <List.SubHeader theme={theme}>Presets (one-tap)</List.SubHeader>
                {TTS_CLEANUP_PRESETS.map(preset => (
                  <View key={preset.id} style={styles.presetRow}>
                    <View style={styles.toggleLabel}>
                      <AppText style={{ color: theme.onSurface }}>
                        {preset.title}
                      </AppText>
                      <AppText
                        style={[styles.hint, { color: theme.onSurfaceVariant }]}
                        numberOfLines={2}
                      >
                        {preset.description}
                      </AppText>
                    </View>
                    <Button
                      title="Add"
                      mode="outlined"
                      compact
                      onPress={() => handleApplyPreset(preset)}
                    />
                  </View>
                ))}
              </View>
            )}

            {mode === 'rule' ? (
              <View style={styles.form}>
                <TextInput
                  {...inputProps}
                  label="Find"
                  value={ruleForm.pattern}
                  onChangeText={text =>
                    setRuleForm(f => ({ ...f, pattern: text }))
                  }
                  style={styles.formField}
                />
                <TextInput
                  {...inputProps}
                  label="Replace with (empty = strip)"
                  value={ruleForm.replacement}
                  onChangeText={text =>
                    setRuleForm(f => ({ ...f, replacement: text }))
                  }
                  style={styles.formField}
                />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabel}>
                    <AppText style={{ color: theme.onSurface }}>
                      Treat as regex
                    </AppText>
                    <AppText
                      style={[styles.hint, { color: theme.onSurfaceVariant }]}
                    >
                      Invalid regexes are skipped automatically
                    </AppText>
                  </View>
                  <Switch
                    value={ruleForm.isRegex}
                    onValueChange={() =>
                      setRuleForm(f => ({ ...f, isRegex: !f.isRegex }))
                    }
                  />
                </View>
                {ruleForm.isRegex && (
                  <>
                    <TextInput
                      {...inputProps}
                      label="Regex flags"
                      placeholder="g"
                      value={ruleForm.flags}
                      onChangeText={text =>
                        setRuleForm(f => ({ ...f, flags: text }))
                      }
                      style={styles.formField}
                    />
                    <AppText
                      style={[styles.hint, { color: theme.onSurfaceVariant }]}
                    >
                      Note: regex patterns match text after Unicode
                      normalization — precomposed characters (e.g. é) will not
                      match normalized text. Use the decomposed form or disable
                      normalization.
                    </AppText>
                  </>
                )}
                {ruleFormError && (
                  <AppText style={[styles.formError, { color: theme.error }]}>
                    {ruleFormError}
                  </AppText>
                )}
                <View style={styles.formActions}>
                  <Button
                    title="Cancel"
                    mode="text"
                    onPress={() => {
                      setMode('list');
                      setRuleForm(EMPTY_RULE_FORM);
                      setRuleFormError(null);
                    }}
                  />
                  <Button title="Save" mode="contained" onPress={saveRule} />
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <List.SubHeader theme={theme}>
                  Find &amp; Replace Rules
                </List.SubHeader>
                {draft.rules.length === 0 ? (
                  <AppText
                    style={[
                      styles.emptyText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    No rules yet. Add rules to strip watermarks, fix corrupted
                    text (e.g. "u2014"), or replace lookalike characters.
                  </AppText>
                ) : (
                  draft.rules.map((rule, index) => (
                    <View key={rule.id} style={styles.ruleRow}>
                      <Switch
                        value={rule.enabled}
                        onValueChange={() =>
                          updateRule(rule.id, { enabled: !rule.enabled })
                        }
                      />
                      <AppText
                        style={[styles.ruleText, { color: theme.onSurface }]}
                        numberOfLines={1}
                      >
                        {formatRuleSummary(rule)}
                      </AppText>
                      <IconButtonV2
                        name="arrow-up"
                        theme={theme}
                        disabled={index === 0}
                        onPress={() => moveRule(rule.id, -1)}
                      />
                      <IconButtonV2
                        name="arrow-down"
                        theme={theme}
                        disabled={index === draft.rules.length - 1}
                        onPress={() => moveRule(rule.id, 1)}
                      />
                      <IconButtonV2
                        name="pencil-outline"
                        theme={theme}
                        onPress={() => {
                          setRuleForm({
                            id: rule.id,
                            pattern: rule.pattern,
                            replacement: rule.replacement,
                            isRegex: rule.isRegex,
                            flags: rule.flags,
                          });
                          setRuleFormError(null);
                          setMode('rule');
                        }}
                      />
                      <IconButtonV2
                        name="delete-outline"
                        theme={theme}
                        onPress={() => removeRule(rule.id)}
                      />
                    </View>
                  ))
                )}
                <View style={styles.addButtonContainer}>
                  <Button
                    title="Add rule"
                    mode="outlined"
                    onPress={() => {
                      setRuleForm(EMPTY_RULE_FORM);
                      setRuleFormError(null);
                      setMode('rule');
                    }}
                  />
                </View>
              </View>
            )}

            {mode === 'pair' ? (
              <View style={styles.form}>
                <TextInput
                  {...inputProps}
                  label="Word"
                  value={pairForm.word}
                  onChangeText={text =>
                    setPairForm(f => ({ ...f, word: text }))
                  }
                  style={styles.formField}
                />
                <TextInput
                  {...inputProps}
                  label="Say instead"
                  value={pairForm.pronunciation}
                  onChangeText={text =>
                    setPairForm(f => ({ ...f, pronunciation: text }))
                  }
                  style={styles.formField}
                />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabel}>
                    <AppText style={{ color: theme.onSurface }}>
                      Replace every occurrence (substring)
                    </AppText>
                    <AppText
                      style={[styles.hint, { color: theme.onSurfaceVariant }]}
                    >
                      Needed for unspaced CJK text; off = whole-word only
                    </AppText>
                  </View>
                  <Switch
                    value={pairForm.matchMode === 'substring'}
                    onValueChange={() =>
                      setPairForm(f => ({
                        ...f,
                        matchMode:
                          f.matchMode === 'substring'
                            ? 'whole-word'
                            : 'substring',
                      }))
                    }
                  />
                </View>
                <View style={styles.formActions}>
                  <Button
                    title="Cancel"
                    mode="text"
                    onPress={() => {
                      setMode('list');
                      setPairForm(EMPTY_PAIR_FORM);
                    }}
                  />
                  <Button title="Save" mode="contained" onPress={savePair} />
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <List.SubHeader theme={theme}>
                  Phonetic Dictionary
                </List.SubHeader>
                {draft.phoneticPairs.length === 0 ? (
                  <AppText
                    style={[
                      styles.emptyText,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    No phonetic swaps yet. Add name/honorific pronunciation
                    fixes (e.g. "Xianxia" → "Shee-an-shah").
                  </AppText>
                ) : (
                  draft.phoneticPairs.map((pair, index) => (
                    <View key={pair.id} style={styles.ruleRow}>
                      <Switch
                        value={pair.enabled}
                        onValueChange={() =>
                          updatePair(pair.id, { enabled: !pair.enabled })
                        }
                      />
                      <AppText
                        style={[styles.ruleText, { color: theme.onSurface }]}
                        numberOfLines={1}
                      >
                        {formatPairSummary(pair)}
                      </AppText>
                      <IconButtonV2
                        name="arrow-up"
                        theme={theme}
                        disabled={index === 0}
                        onPress={() => movePair(pair.id, -1)}
                      />
                      <IconButtonV2
                        name="arrow-down"
                        theme={theme}
                        disabled={index === draft.phoneticPairs.length - 1}
                        onPress={() => movePair(pair.id, 1)}
                      />
                      <IconButtonV2
                        name="pencil-outline"
                        theme={theme}
                        onPress={() => {
                          setPairForm({
                            id: pair.id,
                            word: pair.word,
                            pronunciation: pair.pronunciation,
                            matchMode: pair.matchMode ?? 'whole-word',
                          });
                          setMode('pair');
                        }}
                      />
                      <IconButtonV2
                        name="delete-outline"
                        theme={theme}
                        onPress={() => removePair(pair.id)}
                      />
                    </View>
                  ))
                )}
                <View style={styles.addButtonContainer}>
                  <Button
                    title="Add phonetic pair"
                    mode="outlined"
                    onPress={() => {
                      setPairForm(EMPTY_PAIR_FORM);
                      setMode('pair');
                    }}
                  />
                </View>
              </View>
            )}

            <View style={styles.formActions}>
              <Button title="Cancel" mode="text" onPress={onDismiss} />
              <Button
                title="Save"
                mode="contained"
                onPress={() => {
                  onSave(draft);
                  onDismiss();
                }}
              />
            </View>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

export default TtsTextCleanupModal;
