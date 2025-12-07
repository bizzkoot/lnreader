# Plan: Point update checker to your GitHub repo (detailed)

TL;DR — Update the GitHub Releases API URL in `src/hooks/common/useGithubUpdateChecker.ts` to `bizzkoot/lnreader`, ensure your releases are public and contain a stable asset (or implement asset selection by name), and optionally add auth (token/proxy) to avoid rate limits and access private repos.

## Steps

1. Edit the hook
   - Change the endpoint in `src/hooks/common/useGithubUpdateChecker.ts` from:
     `https://api.github.com/repos/rajarsheechatterjee/lnreader/releases/latest`
     to:
     `https://api.github.com/repos/bizzkoot/lnreader/releases/latest`.

2. Verify call sites
   - Confirm `latestRelease` / `downloadUrl` usage in `App.tsx` and `NewUpdateDialog` so the download flow consumes the returned `assets[0].browser_download_url`. Update UI copy or links as needed.

3. Harden asset selection (Option B — recommended)
   - Either:
     A) Publish releases with a stable asset filename so `/releases/latest/download/{asset}` can be used, or
     B) Change the hook to search the `assets` array and select the correct APK by matching a filename pattern (e.g. endsWith `.apk`) or `content_type` — this avoids relying on asset order.

4. Decide auth strategy
   - If the repo is public and checks are infrequent, unauthenticated requests are fine.
   - If you expect many clients or the repo is private, use a server-side proxy (preferred) that stores a GitHub PAT and returns sanitized release info to the app; do NOT embed a PAT in the mobile client.

5. Update docs/templates (optional)
   - If you want project docs or issue templates to point to `bizzkoot/lnreader` rather than upstream, update those links.

6. Test
   - Run the app, trigger the update check, confirm `latestRelease.downloadUrl` resolves and the update dialog links to the intended `.apk` asset.

## Further considerations

- Rate limits: unauthenticated API requests = 60 req/hour/IP. Authenticated (PAT) = 5,000 req/hour. Consider a proxy if load is high.
- Stable URL option: `https://github.com/bizzkoot/lnreader/releases/latest/download/<ASSET_NAME>` provides a stable human-readable link but requires consistent asset names.
- Platform constraints: distributing installers differs by platform (Android APK vs iOS). Ensure proper signing and platform-appropriate distribution flows.
- Security: never embed a PAT in the client; use a secure server-side proxy for auth-required access.

## Example: Robust APK selection

Instead of assuming `assets[0]`, prefer scanning `assets` for an APK asset, e.g.:

1. Filter assets for `name` ending in `.apk` or `content_type: application/vnd.android.package-archive`.
2. Prefer an asset with a predictable naming pattern (like `lnreader-{version}.apk`) if available.

This approach prevents accidental downloads of non-installers (debug artifacts, zips, or unrelated files).

---

If you want, I can create the exact code diff to implement Option B in `src/hooks/common/useGithubUpdateChecker.ts` (including tests and a short migration note). Otherwise, follow the steps above to prepare releases and/or add a proxy for authenticated requests.
# Plan: Point update checker to your GitHub repo (detailed)

TL;DR — Update the GitHub Releases API URL in `useGithubUpdateChecker.ts` to `bizzkoot/lnreader`, ensure your releases are public and contain a stable asset (or implement asset selection by name), and optionally add auth (token/proxy) to avoid rate limits and access private repos.

## Overview
This document describes the changes required to make the app check your repository (`bizzkoot/lnreader`) for the latest release. It covers the exact code edit, verification steps, hardening options for asset selection, authentication strategies, testing, and operational considerations such as rate limits and platform-specific distribution concerns.

## Steps

1. Edit the hook

- Change the endpoint in `src/hooks/common/useGithubUpdateChecker.ts` from:

  `https://api.github.com/repos/rajarsheechatterjee/lnreader/releases/latest`

  to:

  `https://api.github.com/repos/bizzkoot/lnreader/releases/latest`

  Rationale: This points the update check to your repository’s latest release metadata.

2. Verify call sites

- Confirm how `latestRelease` / `downloadUrl` are consumed in the app (for example `App.tsx` and any `NewUpdateDialog` component). The hook commonly returns a structure where an asset download URL is used (e.g. `assets[0].browser_download_url`).
- Update UI text or links if they include hardcoded repo references.

3. Harden asset selection (recommended)

- Option A — Stable asset filename:
  - Publish releases with a stable asset filename and use the redirect form:
    `https://github.com/bizzkoot/lnreader/releases/latest/download/<ASSET_NAME>`
  - Pros: Simple, stable human-readable URL.
  - Cons: Requires consistent asset naming across releases.

- Option B — Asset selection by metadata (more robust):
  - Change the hook logic to select the correct asset by `name`, `content_type`, or other metadata instead of assuming `assets[0]`.
  - Example selection criteria: asset name contains `apk` or `arm64` (platform-specific), or content_type matches expected installer type.
  - Pros: Resilient to asset ordering changes.
  - Cons: Requires a small change to the hook.

4. Decide auth strategy

- Public repo & low client volume
  - No auth required. Unauthenticated API calls are allowed (subject to rate limits).

- High volume or private repo
  - Do NOT embed a GitHub PAT in the client app. Instead:
    - Use a server-side proxy that calls GitHub with a PAT and returns the necessary metadata to the client, or
    - Issue short-lived tokens from a secure backend to clients.
  - Pros: Avoids exposing credentials and raises API rate limits (authenticated = 5,000 req/hour).

5. Update docs/templates (optional)

- Replace any README/issue templates or docs that referred to the old repo URL to avoid confusion.

6. Test

- Run the app and trigger the update check. Confirm:
  - The hook returns the expected `latestRelease` object.
  - The selected asset `browser_download_url` resolves and is downloadable.
  - The update dialog navigates to or downloads the correct asset for the intended platform.

## Deeper analysis & recommendations

- API shape and assumptions
  - The GitHub Releases API returns a `release` object with an `assets` array. Many implementations assume the release’s primary asset is `assets[0]` — this is brittle.
  - Instead, pick assets by comparing `asset.name` or `asset.content_type` to an expected set. For example, choose the first asset where `name.endsWith('.apk')` and `name.includes('arm64')` for Android arm64 builds.

- Rate limits and caching
  - Unauthenticated requests: 60 requests/hour/IP. Authenticated requests: 5,000 requests/hour per token.
  - Mitigations:
    - Cache results server-side or within the app for a reasonable TTL (e.g. 10–30 minutes).
    - Use a server proxy to centralize requests and authenticate with a PAT.

- Stable download URL vs API asset URL
  - Using `https://github.com/<owner>/<repo>/releases/latest/download/<ASSET_NAME>` gives a stable redirect to the latest release’s named asset. It requires consistent naming but avoids parsing JSON.
  - Using the API (`assets[*].browser_download_url`) is more flexible for choosing platform-specific assets.

- Security & privacy
  - Never store or ship a PAT inside the client binary. Treat tokens as secrets in CI or server environments only.
  - If your repo is private, use a trusted backend to supply the client with authenticated metadata.

- Platform distribution
  - Android: deliver `.apk` or `.aab` assets — ensure they’re signed appropriately. Consider Play Store vs direct-download implications.
  - iOS: direct distribution of signed installers is restricted; use TestFlight or proper signing processes.

## Implementation variants (quick)

- Minimal change
  - Update the endpoint URL in the hook and rely on `assets[0]`. Fast but fragile.

- Robust change (recommended)
  - Update the endpoint URL and implement asset selection logic by name/content_type. Optionally use a stable asset filename for direct download links.

- Enterprise-ready
  - Add a secure backend proxy that uses a PAT, caches responses, adds rate limiting, and exposes a small, authenticated endpoint your clients hit for update checks.

## Acceptance criteria

- The hook in `src/hooks/common/useGithubUpdateChecker.ts` points to `bizzkoot/lnreader`.
- The app successfully retrieves and resolves a download URL for the intended platform.
- Tests cover the asset selection logic (unit tests for the hook) and the update flow is manually validated in at least one environment (Android emulator/device).

## Notes
- If you want, I can produce a small patch that performs either the minimal change (URL replacement) or the robust change (URL + asset selection). Indicate which variant you prefer.


---

Generated on request. Ensure this file is placed at the repository root or a docs folder as preferred.
