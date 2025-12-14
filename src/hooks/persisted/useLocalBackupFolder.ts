import { useMMKVString } from 'react-native-mmkv';

export const LOCAL_BACKUP_FOLDER_URI = 'LOCAL_BACKUP_FOLDER_URI';

export const useLocalBackupFolder = () => {
  const [folderUri, setFolderUri] = useMMKVString(LOCAL_BACKUP_FOLDER_URI);

  const getFolderName = (uri: string | undefined): string | undefined => {
    if (!uri) return undefined;
    try {
      const name = uri.split('%2F').pop() || uri.split('/').pop();
      return name ? decodeURIComponent(name) : undefined;
    } catch {
      return undefined;
    }
  };

  return {
    folderUri,
    setFolderUri,
    folderName: getFolderName(folderUri),
    clearFolder: () => setFolderUri(undefined),
  };
};
