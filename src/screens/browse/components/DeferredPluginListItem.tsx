import React, { useEffect, useState } from 'react';

import { PluginItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import { BrowseScreenProps } from '@navigators/types';
import { UseBooleanReturnType } from '@hooks';
import { PluginListItem } from './PluginListItem';
import { PluginListItemSkeleton } from './PluginListItemSkeleton';

interface DeferredPluginListItemProps {
  item: PluginItem;
  theme: ThemeColors;
  navigation: BrowseScreenProps['navigation'];
  settingsModal: UseBooleanReturnType;
  navigateToSource: (plugin: PluginItem, showLatestNovels?: boolean) => void;
  setSelectedPluginId: React.Dispatch<React.SetStateAction<string>>;
}

export const DeferredPluginListItem = (props: DeferredPluginListItemProps) => {
  const [showReal, setShowReal] = useState(false);

  useEffect(() => {
    // Use setTimeout as an alternative to deprecated InteractionManager
    // This defers the rendering until after the current render cycle
    const timeoutId = setTimeout(() => {
      setShowReal(true);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  return showReal ? (
    <PluginListItem {...props} />
  ) : (
    <PluginListItemSkeleton item={props.item} theme={props.theme} />
  );
};
