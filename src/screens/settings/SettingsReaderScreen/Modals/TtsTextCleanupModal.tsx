import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
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
} from '@utils/htmlParagraphExtractor';

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

const TtsTextCleanupModal: React.FC<TtsTextCleanupModalProps> = ({
  visible,
  onDismiss,
  settings,
  onSave,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();

  const [draft, setDraft] = useState<TtsTextCleanupSettings>(settings);
  const [mode, setMode] = useState<EditorMode>('list');
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [pairForm, setPairForm] = useState<PairFormState>(EMPTY_PAIR_FORM);

  // Re-sync draft whenever the modal opens or settings change externally.
  useEffect(() => {
    if (visible) {
      setDraft(settings);
      setMode('list');
      setRuleForm(EMPTY_RULE_FORM);
      setPairForm(EMPTY_PAIR_FORM);
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

  const removePair = (id: string) => {
    setDraft(d => ({
      ...d,
      phoneticPairs: d.phoneticPairs.filter(p => p.id !== id),
    }));
  };

  const saveRule = () => {
    if (!ruleForm.pattern.trim()) {
      return;
    }
    setDraft(d => {
      if (ruleForm.id) {
        return {
          ...d,
          rules: d.rules.map(r =>
            r.id === ruleForm.id
              ? {
                  ...r,
                  pattern: ruleForm.pattern,
                  replacement: ruleForm.replacement,
                  isRegex: ruleForm.isRegex,
                  flags: ruleForm.flags,
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
            ruleForm.pattern,
            ruleForm.replacement,
            ruleForm.isRegex,
            ruleForm.flags,
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
                  word: pairForm.word,
                  pronunciation: pairForm.pronunciation,
                }
              : p,
          ),
        };
      }
      return {
        ...d,
        phoneticPairs: [
          ...d.phoneticPairs,
          createTtsPhoneticPair(pairForm.word, pairForm.pronunciation),
        ],
      };
    });
    setMode('list');
    setPairForm(EMPTY_PAIR_FORM);
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
                )}
                <View style={styles.formActions}>
                  <Button
                    title="Cancel"
                    mode="text"
                    onPress={() => {
                      setMode('list');
                      setRuleForm(EMPTY_RULE_FORM);
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
                  draft.rules.map(rule => (
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
                  draft.phoneticPairs.map(pair => (
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
                        name="pencil-outline"
                        theme={theme}
                        onPress={() => {
                          setPairForm({
                            id: pair.id,
                            word: pair.word,
                            pronunciation: pair.pronunciation,
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
