import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Divider, Portal } from 'react-native-paper';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { Button, Modal } from '@components/index';

import { useTheme, useAppSettings } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';

import { getString } from '@strings/translations';
import { getCategoriesWithCount } from '@database/queries/CategoryQueries';
import { updateNovelCategories } from '@database/queries/NovelQueries';
import { CCategory, Category } from '@database/types';
import { Checkbox } from '@components/Checkbox/Checkbox';
import { xor } from 'lodash-es';
import { RootStackParamList } from '@navigators/types';
import AppText from '@components/AppText';

interface SetCategoryModalProps {
  novelIds: number[];
  visible: boolean;
  onEditCategories?: () => void;
  closeModal: () => void;
  onSuccess?: () => void | Promise<void>;
}

const SetCategoryModal: React.FC<SetCategoryModalProps> = ({
  novelIds,
  closeModal,
  visible,
  onSuccess,
  onEditCategories,
}) => {
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categories = [], setCategories] = useState<CCategory[]>();
  const { uiScale = 1.0 } = useAppSettings();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        divider: { height: 1, width: '90%', marginLeft: '5%' },
        btnContainer: {
          flexDirection: 'row',
          marginTop: scaleDimension(20, uiScale),
        },
        checkboxView: {
          marginBottom: scaleDimension(5, uiScale),
        },
        flex: {
          flex: 1,
        },
        modalTitle: {
          fontSize: scaleDimension(24, uiScale),
          marginBottom: scaleDimension(20, uiScale),
        },
        modelOption: {
          fontSize: scaleDimension(15, uiScale),
          marginVertical: scaleDimension(10, uiScale),
        },
      }),
    [uiScale],
  );

  const getCategories = useCallback(async () => {
    const res = getCategoriesWithCount(novelIds);
    setCategories(res);
    setSelectedCategories(res.filter(c => c.novelsCount));
  }, [novelIds]);

  useEffect(() => {
    if (visible) {
      getCategories();
    }
  }, [getCategories, visible]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => {
          closeModal();
          setSelectedCategories([]);
        }}
      >
        <AppText style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('categories.setCategories')}
        </AppText>
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <Checkbox
              status={
                selectedCategories.find(category => category.id === item.id) !==
                undefined
              }
              label={item.name}
              onPress={() =>
                setSelectedCategories(xor(selectedCategories, [item]))
              }
              viewStyle={styles.checkboxView}
              theme={theme}
            />
          )}
          ListEmptyComponent={
            <AppText
              style={{
                color: theme.onSurfaceVariant,
                fontSize: scaleDimension(14, uiScale),
              }}
            >
              {getString('categories.setModalEmptyMsg')}
            </AppText>
          }
        />
        <Divider
          style={[
            {
              backgroundColor: theme.onSurfaceDisabled,
            },
            styles.divider,
          ]}
        />
        <View style={styles.btnContainer}>
          <Button
            title={getString('common.edit')}
            onPress={() => {
              navigate('MoreStack', {
                screen: 'Categories',
              });
              closeModal();
              onEditCategories?.();
            }}
          />
          <View style={styles.flex} />
          <Button
            title={getString('common.cancel')}
            onPress={() => {
              closeModal();
            }}
          />
          <Button
            title={getString('common.ok')}
            onPress={async () => {
              await updateNovelCategories(
                novelIds,
                selectedCategories.map(category => category.id),
              );
              closeModal();
              onSuccess?.();
            }}
          />
        </View>
      </Modal>
    </Portal>
  );
};

export default SetCategoryModal;
