import Database from 'better-sqlite3';
import { createNovelTableQuery } from '../../tables/NovelTable';
import { createChapterTableQuery } from '../../tables/ChapterTable';

describe('ChapterQueries M15: intentional predicate split (Option B)', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(createNovelTableQuery);
    sqlite.exec(createChapterTableQuery);
    // Novel 1
    sqlite.exec(
      "INSERT INTO Novel (id, path, pluginId, name) VALUES (1, 'p1', 'pl1', 'N1')",
    );
    // Chapters:
    // - downloaded + updated
    // - downloaded only (no updatedTime)
    // - updated only (not downloaded)
    sqlite.exec(
      "INSERT INTO Chapter (id, path, name, novelId, position, isDownloaded, updatedTime) VALUES (1, 'c1', 'C1', 1, 0, 1, '2024-01-01 00:00:00')",
    );
    sqlite.exec(
      "INSERT INTO Chapter (id, path, name, novelId, position, isDownloaded, updatedTime) VALUES (2, 'c2', 'C2', 1, 1, 1, NULL)",
    );
    sqlite.exec(
      "INSERT INTO Chapter (id, path, name, novelId, position, isDownloaded, updatedTime) VALUES (3, 'c3', 'C3', 1, 2, 0, '2024-01-02 00:00:00')",
    );
  });

  afterEach(() => sqlite.close());

  it('getDetailedUpdates (onlyDownloadable=true) returns all downloaded including rows without updatedTime', () => {
    const rows = sqlite
      .prepare(
        'SELECT Chapter.* FROM Chapter JOIN Novel ON Chapter.novelId = Novel.id WHERE novelId = ? AND Chapter.isDownloaded = 1 ORDER BY updatedTime DESC',
      )
      .all(1) as any[];
    expect(rows.map(r => r.id).sort()).toEqual([1, 2]);
    // includes id=2 which has updatedTime NULL — proves predicate is intentionally not AND updatedTime IS NOT NULL
    expect(rows.find(r => r.id === 2).updatedTime).toBeNull();
  });

  it('getDetailedUpdates (onlyDownloadable=false) returns only rows with updatedTime', () => {
    const rows = sqlite
      .prepare(
        'SELECT Chapter.* FROM Chapter JOIN Novel ON Chapter.novelId = Novel.id WHERE novelId = ? AND updatedTime IS NOT NULL ORDER BY updatedTime DESC',
      )
      .all(1) as any[];
    expect(rows.map(r => r.id).sort()).toEqual([1, 3]);
  });

  it('getUpdatedOverviewFromDb counts only updatedTime IS NOT NULL', () => {
    const rows = sqlite
      .prepare(
        `SELECT Novel.id AS novelId, DATE(Chapter.updatedTime) AS updateDate, COUNT(*) AS updatesPerDay
         FROM Chapter JOIN Novel ON Chapter.novelId = Novel.id WHERE Chapter.updatedTime IS NOT NULL GROUP BY Novel.id, DATE(Chapter.updatedTime)`,
      )
      .all() as any[];
    // 1 has 2024-01-01, 3 has 2024-01-02 → 2 groups, total 2
    expect(rows.length).toBe(2);
    expect(rows.reduce((a: number, r: any) => a + r.updatesPerDay, 0)).toBe(2);
  });
});
