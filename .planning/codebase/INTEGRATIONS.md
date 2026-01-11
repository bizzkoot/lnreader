# External Integrations

**Analysis Date:** 2026-01-06

## APIs & External Services

**Cloud Storage:**
- Google Drive API - Backup and restore functionality
  - SDK/Client: Custom implementation in `src/api/drive/request.ts`
  - Auth: OAuth2 via Google Sign-In
  - Endpoints used: File upload, download, listing

**External APIs:**
- Novel source plugins - Dynamic loading from external repositories
  - Integration method: Dynamic import with validation
  - Auth: Varies by source (cookies, tokens)
  - Rate limits: Handled per source

**DNS over HTTPS (DoH):**
- Cloudflare (1.1.1.1) - DNS resolution
- Google (8.8.8.8) - DNS resolution
- AdGuard (94.140.14.140) - DNS resolution
  - Implementation: `src/services/network/DoHManager.ts`
  - Certificate pinning: Placeholder hashes (needs real certificates)

## Data Storage

**Databases:**
- SQLite (via expo-sqlite) - Primary data store
  - Connection: `src/database/db.ts`
  - Client: expo-sqlite with custom query layer
  - Migrations: `src/database/migrations/`

**File Storage:**
- Local filesystem - Chapter content, plugin cache, backups
  - SDK/Client: expo-file-system
  - Locations: Document directory, caches

**Key-Value Storage:**
- MMKV - High-performance storage for settings and progress
  - SDK/Client: react-native-mmkv
  - Keys: Settings, chapter progress, TTS state

## Authentication & Identity

**Auth Provider:**
- Google Sign-In - Google Drive backup authentication
  - Implementation: @react-native-google-signin/google-signin
  - Token storage: Secure storage via expo-secure-store
  - Session management: OAuth tokens

**OAuth Integrations:**
- Google OAuth - Drive access only
  - Credentials: Configured in Google Cloud Console
  - Scopes: Drive read/write

## Monitoring & Observability

**Error Tracking:**
- None currently (consider adding Sentry)

**Analytics:**
- None currently

**Logs:**
- Console only - stdout/stderr
  - Integration: Development builds only
  - Rate-limited logging via `@utils/rateLimitedLogger`

## CI/CD & Deployment

**Hosting:**
- GitHub Releases - APK distribution
  - Deployment: Manual release process
  - Environment vars: Not applicable (client-side only)

**CI Pipeline:**
- None currently (local builds only)

## Environment Configuration

**Development:**
- Required env vars: None (all defaults work)
- Secrets location: `android/app/google-services.json` (gitignored)
- Mock/stub services: Local plugin testing

**Staging:**
- Not applicable (single environment)

**Production:**
- Secrets management: google-services.json (not committed)
- Failover: None

## Webhooks & Callbacks

**Incoming:**
- None (no server component)

**Outgoing:**
- Plugin repository fetching - Get plugin manifests
  - Endpoint: Configured per repository
  - Retry logic: Exponential backoff

**Tracker Services:**
- AniList API - Track reading progress
  - Implementation: `src/services/Trackers/aniList.ts`
  - Auth: OAuth token
- MyAnimeList API - Track reading progress
  - Implementation: `src/services/Trackers/myAnimeList.ts`
  - Auth: OAuth token
- MangaUpdates API - Track reading progress
  - Implementation: `src/services/Trackers/mangaUpdates.ts`
  - Auth: None (public API)

---

*Integration audit: 2026-01-06*
*Update when adding/removing external services*
