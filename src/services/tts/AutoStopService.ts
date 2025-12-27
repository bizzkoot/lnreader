export type AutoStopMode = 'off' | 'minutes' | 'chapters' | 'paragraphs';

export type AutoStopReason = Exclude<AutoStopMode, 'off'>;

export interface AutoStopConfig {
  mode: AutoStopMode;
  amount: number;
}

export class AutoStopService {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private config: AutoStopConfig = { mode: 'off', amount: 0 };
  private onAutoStop: ((reason: AutoStopReason) => void) | null = null;

  private paragraphsSpoken = 0;
  private chaptersFinished = 0;

  start(
    config: AutoStopConfig,
    onAutoStop: (reason: AutoStopReason) => void,
  ): void {
    this.stop();

    this.config = config;
    this.onAutoStop = onAutoStop;

    if (config.mode === 'off') return;
    if (!Number.isFinite(config.amount) || config.amount <= 0) return;

    if (config.mode === 'minutes') {
      const ms = Math.round(config.amount * 60_000);
      this.timeout = setTimeout(() => {
        this.trigger('minutes');
      }, ms);
    }
  }

  stop(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.onAutoStop = null;
    this.config = { mode: 'off', amount: 0 };
    this.paragraphsSpoken = 0;
    this.chaptersFinished = 0;
  }

  resetCounters(): void {
    this.paragraphsSpoken = 0;
    this.chaptersFinished = 0;

    if (this.config.mode === 'minutes' && this.onAutoStop) {
      const { amount } = this.config;
      if (Number.isFinite(amount) && amount > 0) {
        if (this.timeout) clearTimeout(this.timeout);
        const ms = Math.round(amount * 60_000);
        this.timeout = setTimeout(() => {
          this.trigger('minutes');
        }, ms);
      }
    }
  }

  onParagraphSpoken(): void {
    if (this.config.mode !== 'paragraphs') return;
    if (!this.onAutoStop) return;
    if (!Number.isFinite(this.config.amount) || this.config.amount <= 0) return;

    this.paragraphsSpoken += 1;
    if (this.paragraphsSpoken >= this.config.amount) {
      this.trigger('paragraphs');
    }
  }

  onChapterFinished(): void {
    if (this.config.mode !== 'chapters') return;
    if (!this.onAutoStop) return;
    if (!Number.isFinite(this.config.amount) || this.config.amount <= 0) return;

    this.chaptersFinished += 1;
    if (this.chaptersFinished >= this.config.amount) {
      this.trigger('chapters');
    }
  }

  private trigger(reason: AutoStopReason): void {
    const cb = this.onAutoStop;
    this.stop();
    cb?.(reason);
  }
}

export const autoStopService = new AutoStopService();
