import { SQLiteDatabase } from 'expo-sqlite';
import { Migration } from '../types/migration';
import { showToast } from '@utils/showToast';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const migrationLog = createRateLimitedLogger('Migration', { windowMs: 1500 });

/**
 * Migration runner that handles database version upgrades
 */
export class MigrationRunner {
  private migrations: Migration[];

  constructor(migrations: Migration[]) {
    this.migrations = [...migrations].sort((a, b) => a.version - b.version);
    this.validateMigrations();
  }

  /**
   * Validates migrations: no duplicates, positive versions, warns on non-sequential versions
   */
  private validateMigrations(): void {
    const versions = new Set<number>();

    for (const migration of this.migrations) {
      if (migration.version <= 0) {
        throw new Error(
          `Migration version must be positive: ${migration.version}`,
        );
      }

      if (versions.has(migration.version)) {
        throw new Error(
          `Duplicate migration version found: ${migration.version}`,
        );
      }

      versions.add(migration.version);
    }

    const sortedVersions = Array.from(versions).sort((a, b) => a - b);
    for (let i = 0; i < sortedVersions.length; i++) {
      if (sortedVersions[i] !== i + 1 && __DEV__) {
        migrationLog.warn(
          'non-sequential',
          `Migration versions are not sequential. Expected ${i + 1}, found ${sortedVersions[i]}`,
        );
      }
    }
  }

  private getCurrentVersion(db: SQLiteDatabase): number {
    try {
      const result = db.getFirstSync<{ user_version: number }>(
        'PRAGMA user_version',
      );
      return result?.user_version ?? 0;
    } catch (error) {
      // If PRAGMA query fails, assume version 0 (fresh database)
      migrationLog.warn(
        'get-version-failed',
        'Failed to get database version, assuming 0:',
        error,
      );
      return 0;
    }
  }

  private setVersion(db: SQLiteDatabase, version: number): void {
    db.execSync(`PRAGMA user_version = ${version}`);
  }

  /**
   * Runs all pending migrations in order, each wrapped in a transaction
   * Stops on first error to prevent partial migrations
   */
  runMigrations(db: SQLiteDatabase): void {
    const currentVersion = this.getCurrentVersion(db);

    migrationLog.debug(
      'current-version',
      `Current database version: ${currentVersion}`,
    );

    const pendingMigrations = this.migrations.filter(
      m => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      migrationLog.debug('no-migrations', 'No pending migrations');
      return;
    }

    migrationLog.info(
      'pending-migrations',
      `Running ${pendingMigrations.length} pending migration(s)`,
    );

    for (const migration of pendingMigrations) {
      try {
        migrationLog.info(
          'migration-start',
          `Running migration ${migration.version}${migration.description ? `: ${migration.description}` : ''}`,
        );

        db.withTransactionSync(() => {
          migration.migrate(db);
          this.setVersion(db, migration.version);
        });

        migrationLog.info(
          'migration-complete',
          `Migration ${migration.version} completed successfully`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : `Migration ${migration.version} failed`;

        migrationLog.error(
          'migration-failed',
          `Migration ${migration.version} failed:`,
          error,
        );
        showToast(`Database migration failed: ${errorMessage}`);

        throw error;
      }
    }

    const newVersion = this.getCurrentVersion(db);
    migrationLog.info(
      'migration-done',
      `Database updated to version ${newVersion}`,
    );
  }
}
