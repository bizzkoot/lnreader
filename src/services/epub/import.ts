import dayjs from 'dayjs';
import {
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';
import { LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { db } from '@database/db';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import NativeFile from '@specs/NativeFile';
import NativeZipArchive from '@specs/NativeZipArchive';
import NativeEpub from '@specs/NativeEpub';

export const decodePath = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

export const normalizePath = (path: string) => {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
};

export const basename = (path: string) =>
  path.replace(/\\/g, '/').split('/').pop() || '';

export const createAssetNameMap = (paths: string[]) => {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const rawPath of paths) {
    const sourcePath = normalizePath(decodePath(rawPath));
    if (result.has(sourcePath)) continue;
    const originalName = basename(sourcePath);
    if (!originalName) continue;
    const dot = originalName.lastIndexOf('.');
    const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
    const extension = dot > 0 ? originalName.slice(dot) : '';
    let outputName = originalName;
    let suffix = 2;
    while (used.has(outputName)) {
      outputName = `${stem}-${suffix++}${extension}`;
    }
    used.add(outputName);
    result.set(sourcePath, outputName);
  }
  return result;
};

export const rewriteAssetReferences = (
  content: string,
  sourcePath: string,
  novelDir: string,
  assetNames: Map<string, string>,
  pattern: RegExp,
) => {
  const sourceDirectory = normalizePath(
    decodePath(sourcePath).replace(/[/\\][^/\\]*$/, ''),
  );
  return content.replace(pattern, (full, quote: string, reference: string) => {
    const markerIndex = reference.search(/[?#]/);
    const localReference =
      markerIndex === -1 ? reference : reference.slice(0, markerIndex);
    const suffix = markerIndex === -1 ? '' : reference.slice(markerIndex);
    if (!localReference || /^[a-z][a-z0-9+.-]*:/i.test(localReference)) {
      return full;
    }
    const sourceAsset = normalizePath(
      `${sourceDirectory}/${decodePath(localReference)}`,
    );
    const outputName = assetNames.get(sourceAsset);
    return outputName
      ? `url(${quote}file://${novelDir}/${outputName}${suffix}${quote})`
      : full;
  });
};

const insertLocalNovel = async (
  name: string,
  path: string,
  cover?: string,
  author?: string,
  artist?: string,
  summary?: string,
  coverName?: string,
) => {
  const insertedNovel = await db.runAsync(
    `
      INSERT INTO 
        Novel(name, path, pluginId, inLibrary, isLocal) 
        VALUES(?, ?, 'local', 1, 1)`,
    name,
    path,
  );
  if (insertedNovel.lastInsertRowId && insertedNovel.lastInsertRowId >= 0) {
    await updateNovelCategoryById(insertedNovel.lastInsertRowId, [2]);
    const novelDir = NOVEL_STORAGE + '/local/' + insertedNovel.lastInsertRowId;
    NativeFile.mkdir(novelDir);
    const newCoverPath =
      'file://' + novelDir + '/' + (coverName || basename(cover || ''));

    if (cover) {
      const decodedPath = decodePath(cover);
      if (NativeFile.exists(decodedPath)) {
        NativeFile.moveFile(decodedPath, newCoverPath);
      }
    }
    await updateNovelInfo({
      id: insertedNovel.lastInsertRowId,
      pluginId: LOCAL_PLUGIN_ID,
      author: author,
      artist: artist,
      summary: summary,
      path: NOVEL_STORAGE + '/local/' + insertedNovel.lastInsertRowId,
      cover: newCoverPath,
      name: name,
      inLibrary: true,
      isLocal: true,
      totalPages: 0,
    });
    return insertedNovel.lastInsertRowId;
  }
  throw new Error(getString('advancedSettingsScreen.novelInsertFailed'));
};

const insertLocalChapter = async (
  novelId: number,
  fakeId: number,
  name: string,
  path: string,
  releaseTime: string,
  assetNames: Map<string, string>,
) => {
  const insertedChapter = await db.runAsync(
    'INSERT INTO Chapter(novelId, name, path, releaseTime, position, isDownloaded) VALUES(?, ?, ?, ?, ?, ?)',
    novelId,
    name,
    NOVEL_STORAGE + '/local/' + novelId + '/' + fakeId,
    releaseTime,
    fakeId,
    1,
  );
  if (insertedChapter.lastInsertRowId && insertedChapter.lastInsertRowId >= 0) {
    let chapterText: string = '';
    chapterText = NativeFile.readFile(decodePath(path));
    if (!chapterText) {
      return [];
    }
    const novelDir = NOVEL_STORAGE + '/local/' + novelId;
    const chapterDirectory = normalizePath(
      decodePath(path).replace(/[/\\][^/\\]*$/, ''),
    );
    chapterText = chapterText.replace(
      /=(?<= href=| src=)(["'])([^]*?)\1/g,
      (full, quote: string, reference: string) => {
        const referenceWithoutFragment = reference.split(/[?#]/, 1)[0];
        if (
          !referenceWithoutFragment ||
          /^[a-z][a-z0-9+.-]*:/i.test(referenceWithoutFragment)
        ) {
          return full;
        }
        const sourcePath = normalizePath(
          `${chapterDirectory}/${decodePath(referenceWithoutFragment)}`,
        );
        const outputName = assetNames.get(sourcePath);
        return outputName
          ? `=${quote}file://${novelDir}/${outputName}${quote}`
          : full;
      },
    );
    NativeFile.mkdir(novelDir + '/' + insertedChapter.lastInsertRowId);
    NativeFile.writeFile(
      novelDir + '/' + insertedChapter.lastInsertRowId + '/index.html',
      chapterText,
    );
    return;
  }
  throw new Error(getString('advancedSettingsScreen.chapterInsertFailed'));
};

export const importEpub = async (
  {
    uri,
    filename,
  }: {
    uri: string;
    filename: string;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  const epubFilePath =
    NativeFile.getConstants().ExternalCachesDirectoryPath + '/novel.epub';
  try {
    NativeFile.copyFile(uri, epubFilePath);
  } catch (error) {
    throw new Error(
      `Failed to read EPUB file "${filename}". The file may have been moved or deleted. Please try importing again.`,
    );
  }
  const epubDirPath =
    NativeFile.getConstants().ExternalCachesDirectoryPath + '/epub';
  if (NativeFile.exists(epubDirPath)) {
    NativeFile.unlink(epubDirPath);
  }
  NativeFile.mkdir(epubDirPath);
  await NativeZipArchive.unzip(epubFilePath, epubDirPath);
  const novel = NativeEpub.parseNovelAndChapters(epubDirPath);
  const assetNames = createAssetNameMap([
    ...(novel.imagePaths || []),
    ...(novel.cssPaths || []),
    ...(novel.cover ? [novel.cover] : []),
  ]);
  if (!novel.name) {
    novel.name = filename.replace('.epub', '') || 'Untitled';
  }
  const novelId = await insertLocalNovel(
    novel.name,
    epubDirPath + novel.name, // temporary
    novel.cover || '',
    novel.author || '',
    novel.artist || '',
    novel.summary || '',
    novel.cover
      ? assetNames.get(normalizePath(decodePath(novel.cover)))
      : undefined,
  );
  const now = dayjs().toISOString();
  if (novel.chapters) {
    for (let i = 0; i < novel.chapters?.length; i++) {
      const chapter = novel.chapters[i];
      if (!chapter.name) {
        chapter.name = chapter.path.split(/[/\\]/).pop() || 'unknown';
      }

      setMeta(meta => ({
        ...meta,
        progressText: chapter.name,
      }));

      await insertLocalChapter(
        novelId,
        i,
        chapter.name,
        chapter.path,
        now,
        assetNames,
      );

      setMeta(meta => ({
        ...meta,
        progress: i / novel.chapters.length,
      }));
    }
  }
  const novelDir = NOVEL_STORAGE + '/local/' + novelId;

  setMeta(meta => ({
    ...meta,
    progressText: getString('advancedSettingsScreen.importStaticFiles'),
  }));

  for (const filePath of novel.imagePaths) {
    const decodedPath = decodePath(filePath);

    if (NativeFile.exists(decodedPath)) {
      NativeFile.moveFile(
        decodedPath,
        novelDir +
          '/' +
          (assetNames.get(normalizePath(decodedPath)) || basename(filePath)),
      );
    }
  }

  for (const filePath of novel.cssPaths) {
    const decodedPath = decodePath(filePath);
    if (NativeFile.exists(decodedPath)) {
      const css = NativeFile.readFile(decodedPath);
      const rewrittenCss = rewriteAssetReferences(
        css,
        decodedPath,
        novelDir,
        assetNames,
        /url\(\s*(["']?)([^)]*?)\1\s*\)/gi,
      );
      NativeFile.writeFile(decodedPath, rewrittenCss);
      NativeFile.moveFile(
        decodedPath,
        novelDir +
          '/' +
          (assetNames.get(normalizePath(decodedPath)) || basename(filePath)),
      );
    }
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));
};
