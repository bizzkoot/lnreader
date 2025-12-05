<p align="center">
  <a href="https://lnreader.app">
    <img src="./.github/readme-images/icon_new.png" align="center" width="128" />
  </a>
</p>

<h1 align="center">LNReader</h1>

<p align="center">
  LNReader is a free and open source light novel reader for Android, inspired by Tachiyomi.
</p>

<div align="center">
  <a href="https://github.com/bizzkoot/lnreader/releases">
    <img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/bizzkoot/lnreader/total?label=downloads&labelColor=27303D&color=0D1117&logo=github&logoColor=FFFFFF&style=flat">
  </a>
</div>

<div align="center">
  <a href="https://github.com/bizzkoot/lnreader/blob/main/LICENSE">
    <img alt="GitHub" src="https://img.shields.io/github/license/bizzkoot/lnreader?labelColor=27303D&color=1a73e8&style=flat">
  </a>
  <a title="Crowdin" target="_blank" href="https://crowdin.com/project/lnreader">
    <img src="https://badges.crowdin.net/lnreader/localized.svg">
  </a>
</div>

<h2 align="center">Download</h2>

<p align="center">
  <a href="https://github.com/bizzkoot/lnreader/releases/latest">
    <img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/bizzkoot/lnreader?label=Stable&labelColor=0d7377&color=084c4e&style=flat">
  </a>
  
</p>

<p align="center">
  Get the app from our <a href="https://github.com/bizzkoot/lnreader/releases">releases page</a>.
</p>

<p align="center">
  <em>Android 7.0 or higher.</em>
</p>

<h2 align="center">Screenshots</h2>

<p align="center">
  <img src="./.github/readme-images/screenshots.png" align="center" />
</p>

## What's New

- **Text-to-Speech (TTS) Overhaul**: A redesigned TTS experience with a draggable
  playback button that remembers its position, improved voice picker with
  human-readable names, advanced TTS settings (Auto Resume, Scroll Sync), and
  more robust playback logic.
- **Background Playback**: TTS continues playing when the screen is off or the
  app is running in the background (Android 14+ compatibility included).
- **Reader Stability Improvements**: Fixes for reader reloads, resume position
  syncing, and smoother scrolling while using TTS.

These improvements are part of ongoing work in this fork — see `RELEASE_NOTES.md` for a detailed changelog.

## Plugins

- **No affiliation with content providers**: LNReader does not endorse or provide content sources.
- **Plugin requests**: For the original upstream plugin repository see [lnreader-plugins](https://github.com/LNReader/lnreader-plugins).

## Translation

- Help translate the app on [Crowdin](https://crowdin.com/project/lnreader).

## Building & Contributing

- See `CONTRIBUTING.md` for setup, build, and contributor guidelines.
- Common commands (run from the repository root):

```bash
pnpm install
pnpm run dev:start    # start development server
pnpm run dev:android  # run on Android emulator/device
pnpm run build:release:android
```

## Download

Get builds from the `releases` page: [bizzkoot/lnreader releases](https://github.com/bizzkoot/lnreader/releases)

Minimum supported Android: Android 7.0 or higher.

## Screenshots

See the screenshots above or in `./.github/readme-images/`.

## License

This project is available under the [MIT license](https://github.com/bizzkoot/lnreader/blob/main/LICENSE).

## Thanks

Thanks to the original LNReader authors and contributors for the project this
fork builds on: [LNReader upstream](https://github.com/LNReader/lnreader)

Repository for this fork: [bizzkoot/lnreader](https://github.com/bizzkoot/lnreader)

