import React, { useMemo } from 'react';
import { StyleSheet, View, FlatList, Text, FlatListProps } from 'react-native';
import { useTheme } from '@hooks/persisted';

import ListView from '../../components/ListView';
import { Appbar } from '@components';
import { SourceNovelsScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import { getString } from '@strings/translations';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { useScaledDimensions } from '@hooks/useScaledDimensions';

const getScaledStyles = (scaled: ReturnType<typeof useScaledDimensions>) => ({
  // Add any scaled styles needed for this component
});

const SourceNovels = ({ navigation, route }: SourceNovelsScreenProps) => {
  const pluginId = route.params.pluginId;
  const theme = useTheme();
  const { library } = useLibraryContext();
  const scaledDimensions = useScaledDimensions();
  const scaledStyles = useMemo(
    () => getScaledStyles(scaledDimensions),
    [scaledDimensions],
  );

  const sourceNovels = library.filter(novel => novel.pluginId === pluginId);

  const renderItem: FlatListProps<NovelInfo>['renderItem'] = ({ item }) => (
    <ListView
      item={item}
      theme={theme}
      scaledStyles={scaledStyles}
      onPress={() =>
        navigation.navigate('MigrateNovel', {
          novel: item,
        })
      }
    />
  );

  return (
    <View style={styles.container}>
      <Appbar
        title={getString('browseScreen.selectNovel')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <FlatList
        data={sourceNovels}
        keyExtractor={item => 'migrateFrom' + item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text
            style={[
              {
                color: theme.onSurfaceVariant,
              },
              styles.text,
            ]}
          >
            {getString('browseScreen.noSource')}
          </Text>
        }
      />
    </View>
  );
};

export default SourceNovels;

const styles = StyleSheet.create({
  container: { flex: 1 },
  text: { padding: 20, textAlign: 'center' },
});
