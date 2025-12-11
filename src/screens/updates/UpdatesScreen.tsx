import React, { memo, Suspense, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { RefreshControl, SectionList, StyleSheet } from 'react-native';
import AppText from '@components/AppText';

import {
  EmptyView,
  ErrorScreenV2,
  SearchbarV2,
  SafeAreaView,
} from '@components';

import { useSearch } from '@hooks';
import { useTheme, useAppSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { scaleDimension } from '@theme/scaling';
import UpdatesSkeletonLoading from './components/UpdatesSkeletonLoading';
import UpdateNovelCard from './components/UpdateNovelCard';
import { deleteChapter } from '@database/queries/ChapterQueries';
import { showToast } from '@utils/showToast';
import ServiceManager from '@services/ServiceManager';
import { UpdateScreenProps } from '@navigators/types';
import { UpdateOverview } from '@database/types';
import { useUpdateContext } from '@components/Context/UpdateContext';

const UpdatesScreen = ({ navigation }: UpdateScreenProps) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);
  const {
    updatesOverview,
    getUpdates,
    lastUpdateTime,
    showLastUpdateTime,
    error,
  } = useUpdateContext();
  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const onChangeText = (text: string) => {
    setSearchText(text);
  };

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          navigation.navigate('MoreStack', {
            screen: 'TaskQueue',
          });
        }
      }),
    [navigation],
  );

  return (
    <SafeAreaView excludeBottom>
      <SearchbarV2
        searchText={searchText}
        clearSearchbar={clearSearchbar}
        placeholder={getString('updatesScreen.searchbar')}
        onChangeText={onChangeText}
        leftIcon="magnify"
        theme={theme}
        rightIcons={[
          {
            iconName: 'reload',
            onPress: () =>
              ServiceManager.manager.addTask({ name: 'UPDATE_LIBRARY' }),
          },
        ]}
      />
      {error ? (
        <ErrorScreenV2 error={error} />
      ) : (
        <SectionList
          extraData={[updatesOverview.length]}
          ListHeaderComponent={
            showLastUpdateTime && lastUpdateTime ? (
              <LastUpdateTime lastUpdateTime={lastUpdateTime} theme={theme} />
            ) : null
          }
          contentContainerStyle={styles.listContainer}
          renderSectionHeader={({ section: { date } }) => (
            <AppText style={[styles.dateHeader, { color: theme.onSurface }]}>
              {dayjs(date).calendar()}
            </AppText>
          )}
          sections={updatesOverview
            .filter(v =>
              searchText
                ? v.novelName.toLowerCase().includes(searchText.toLowerCase())
                : true,
            )
            .reduce(
              (
                acc: { data: UpdateOverview[]; date: string }[],
                cur: UpdateOverview,
              ) => {
                const lastItem =
                  acc.length > 0 ? acc[acc.length - 1] : undefined;
                if (acc.length === 0 || lastItem?.date !== cur.updateDate) {
                  acc.push({ data: [cur], date: cur.updateDate });
                  return acc;
                }
                lastItem?.data.push(cur);
                return acc;
              },
              [],
            )}
          keyExtractor={item => 'updatedGroup' + item.novelId}
          renderItem={({ item }) => (
            <Suspense fallback={<UpdatesSkeletonLoading theme={theme} />}>
              <UpdateNovelCard
                deleteChapter={chapter => {
                  deleteChapter(
                    chapter.pluginId,
                    chapter.novelId,
                    chapter.id,
                  ).then(() => {
                    showToast(
                      getString('common.deleted', {
                        name: chapter.name,
                      }),
                    );
                    getUpdates();
                  });
                }}
                chapterListInfo={item}
                descriptionText={getString('updatesScreen.updatesLower')}
              />
            </Suspense>
          )}
          ListEmptyComponent={
            <EmptyView
              icon="(˘･_･˘)"
              description={getString('updatesScreen.emptyView')}
              theme={theme}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() =>
                ServiceManager.manager.addTask({ name: 'UPDATE_LIBRARY' })
              }
              colors={[theme.onPrimary]}
              progressBackgroundColor={theme.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default memo(UpdatesScreen);

const LastUpdateTime: React.FC<{
  lastUpdateTime: Date | number | string;
  theme: ThemeColors;
}> = ({ lastUpdateTime, theme }) => {
  const { uiScale = 1.0 } = useAppSettings();
  const styles = useMemo(() => createStyles(uiScale), [uiScale]);

  return (
    <AppText style={[styles.lastUpdateTime, { color: theme.onSurface }]}>
      {`${getString('updatesScreen.lastUpdatedAt')} ${dayjs(
        lastUpdateTime,
      ).fromNow()}`}
    </AppText>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    dateHeader: {
      paddingBottom: 2,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    lastUpdateTime: {
      fontSize: scaleDimension(12, uiScale),
      fontStyle: 'italic',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    listContainer: {
      flexGrow: 1,
    },
  });
