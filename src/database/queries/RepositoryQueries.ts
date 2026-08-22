import { Repository } from '@database/types';
import { db } from '@database/db';

const normalizeRepository = (repository: Repository): Repository => ({
  ...repository,
  enabled: repository.enabled !== false && Number(repository.enabled) !== 0,
});

export const getRepositoriesFromDb = () =>
  db
    .getAllSync<Repository>('SELECT * FROM Repository')
    .map(normalizeRepository);

export const getEnabledRepositoriesFromDb = () =>
  db
    .getAllSync<Repository>('SELECT * FROM Repository WHERE enabled = 1')
    .map(normalizeRepository);

export const isRepoUrlDuplicated = (repoUrl: string, excludeId?: number) =>
  (db.getFirstSync<{ isDuplicated: number }>(
    `SELECT COUNT(*) as isDuplicated FROM Repository WHERE url = ?${
      excludeId === undefined ? '' : ' AND id != ?'
    }`,
    ...(excludeId === undefined ? [repoUrl] : [repoUrl, excludeId]),
  )?.isDuplicated || 0) > 0;

export const createRepository = (repoUrl: string) =>
  db.runSync('INSERT INTO Repository (url) VALUES (?)', repoUrl);

export const deleteRepositoryById = (id: number) =>
  db.runSync('DELETE FROM Repository WHERE id = ?', id);

export const updateRepository = (id: number, url: string) =>
  db.runSync('UPDATE Repository SET url = ? WHERE id = ?', url, id);

export const setRepositoryEnabled = (id: number, enabled: boolean) =>
  db.runSync(
    'UPDATE Repository SET enabled = ? WHERE id = ?',
    enabled ? 1 : 0,
    id,
  );
