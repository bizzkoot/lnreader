# Progress (Updated: 2025-12-04)

## Done

- Voice Mapper LOCAL/NETWORK tagging - Added matchedNativeType field to VoiceMapping interface
- Fixed duplicate LOCAL/NETWORK tags in voice display (VoicePickerModal and formatVoiceName)
- Simplified voice name format: removed 'voice' word, region suffix duplication, gender codes
- Created authoritative-voice-map.ts with 115+ English voices from web-speech-recommended-voices
- Created VoiceMapper.ts service with getVoiceMapping() for identifier lookup
- Created utility scripts for voice data extraction and report generation

## Doing



## Next

- Test voice display on actual device
- Consider adding more language support beyond English
