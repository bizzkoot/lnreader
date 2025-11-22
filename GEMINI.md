# GEMINI.md

## Project Overview
LNReader is a React Native application for reading light novels.

## Current Task
Implement TTS Text Highlighting.
- **Goal**: Highlight text as it is being spoken by the TTS engine.
- **Spec**: `specs/tts-text-highlight/TTS Text Highlighting for LNReader.md`
- **Approach**: Create a custom native Android module to expose `onRangeStart` callback from `UtteranceProgressListener`.

## Key Files
- `specs/tts-text-highlight/TTS Text Highlighting for LNReader.md`: Detailed specification.
- `CONTRIBUTING.md`: Build instructions.
- `android/app/src/main/java/com/lnreader/`: Native Android code location.
- `src/`: React Native source code.

## Notes
- The current `react-native-tts` library does not support `onRangeStart`.
- We need to implement a custom native module or fork the library. The spec recommends a custom native module.
- We need to ensure compatibility with Google TTS and handle fallbacks.
