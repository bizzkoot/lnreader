import { shouldIgnoreSaveEvent } from '../saveGuard';

describe('WebViewReader.shouldIgnoreSaveEvent', () => {
  const now = Date.now();

  it('ignores when pendingDeletion is true', () => {
    const event = { data: 10 };
    const opts = {
      pendingDeletion: true,
      chapterTransitionTime: now - 2000,
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: -1,
      latestIdx: -1,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores save events from different chapter', () => {
    const event = { data: 10, chapterId: 5 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 2000,
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: -1,
      latestIdx: -1,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores non-paragraph saves while TTS reading', () => {
    const event = { data: 10 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 2000,
      currentChapterId: 1,
      isTTSReading: true,
      currentIdx: 5,
      latestIdx: 5,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores backward paragraph saves while TTS reading', () => {
    const event = { data: 10, paragraphIndex: 1 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 2000,
      currentChapterId: 1,
      isTTSReading: true,
      currentIdx: 5,
      latestIdx: 5,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores early saves without chapterId during grace period', () => {
    const event = { data: 10 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 100, // within grace period
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: 0,
      latestIdx: 0,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores incoming index smaller than latest during grace period', () => {
    const event = { data: 10, paragraphIndex: 2, chapterId: 1 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 100, // within grace period
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: 5,
      latestIdx: 4,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('ignores initial 0 save in grace period when we have positive latest', () => {
    const event = { data: 10, paragraphIndex: 0, chapterId: 1 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 100, // within grace period
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: 3,
      latestIdx: 2,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(true);
  });

  it('allows regular save event when none of the ignore rules match', () => {
    const event = { data: 10, paragraphIndex: 6, chapterId: 1 };
    const opts = {
      pendingDeletion: false,
      chapterTransitionTime: now - 2000,
      currentChapterId: 1,
      isTTSReading: false,
      currentIdx: 5,
      latestIdx: 5,
    } as const;

    expect(shouldIgnoreSaveEvent(event, opts)).toBe(false);
  });
});
