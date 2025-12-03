import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { TTSHighlight } = NativeModules;

const ttsEmitter = new NativeEventEmitter(TTSHighlight);

export type TTSAudioParams = {
    rate?: number;
    pitch?: number;
    voice?: string;
    utteranceId?: string;
};

const BATCH_SIZE = 15; // Number of paragraphs to queue at once
const REFILL_THRESHOLD = 5; // Refill queue when this many items left

// eslint-disable-next-line no-console
const logDebug = __DEV__ ? console.log : () => {};
// eslint-disable-next-line no-console
const logError = __DEV__ ? console.error : () => {};

class TTSAudioManager {
    private isPlaying = false;
    private currentQueue: string[] = [];
    private currentUtteranceIds: string[] = [];
    private currentIndex = 0;
    private eventListeners: EmitterSubscription[] = [];
    private onDoneCallback?: (utteranceId: string) => void;
    private onQueueEmptyCallback?: () => void;
    // @ts-expect-error Reserved for future use
    private _onQueueLowCallback?: () => void;

    async speak(text: string, params: TTSAudioParams = {}): Promise<string> {
        try {
            const rate = params.rate || 1;
            const pitch = params.pitch || 1;
            const voice = params.voice;
            const utteranceId = params.utteranceId || Date.now().toString();

            await TTSHighlight.speak(text, {
                utteranceId,
                rate,
                pitch,
                voice,
            });

            this.isPlaying = true;
            return utteranceId;
        } catch (error) {
            logError('TTSAudioManager: Failed to speak text:', error);
            throw error;
        }
    }

    async speakBatch(
        texts: string[],
        utteranceIds: string[],
        params: TTSAudioParams = {}
    ): Promise<number> {
        if (texts.length === 0) {
            return 0;
        }

        try {
            const rate = params.rate || 1;
            const pitch = params.pitch || 1;
            const voice = params.voice;

            // Queue initial batch
            const batchTexts = texts.slice(0, BATCH_SIZE);
            const batchIds = utteranceIds.slice(0, BATCH_SIZE);

            await TTSHighlight.speakBatch(batchTexts, batchIds, {
                rate,
                pitch,
                voice,
            });

            // Store remaining for later feeding
            this.currentQueue = texts;
            this.currentUtteranceIds = utteranceIds;
            this.currentIndex = BATCH_SIZE;
            this.isPlaying = true;

            logDebug(
                `TTSAudioManager: Started batch playback with ${batchTexts.length} items, ${texts.length - BATCH_SIZE} remaining`
            );

            // CRITICAL: Set up auto-refill subscription if not already set up
            if (this.eventListeners.length === 0) {
                logDebug('TTSAudioManager: Setting up auto-refill subscription');
                const subscription = ttsEmitter.addListener('onSpeechDone', async (_event) => {
                    // Auto-refill queue
                    await this.refillQueue();
                });
                this.eventListeners.push(subscription);
            }

            return batchTexts.length;
        } catch (error) {
            logError('TTSAudioManager: Failed to speak batch:', error);
            throw error;
        }
    }

    async refillQueue(): Promise<boolean> {
        if (this.currentIndex >= this.currentQueue.length) {
            logDebug('TTSAudioManager: No more items to refill');
            return false;
        }

        try {
            const queueSize = await TTSHighlight.getQueueSize();

            if (queueSize > REFILL_THRESHOLD) {
                // Still enough items in queue
                return false;
            }

            // Add next batch
            const remainingCount = this.currentQueue.length - this.currentIndex;
            const nextBatchSize = Math.min(BATCH_SIZE, remainingCount);

            const nextTexts = this.currentQueue.slice(
                this.currentIndex,
                this.currentIndex + nextBatchSize
            );
            const nextIds = this.currentUtteranceIds.slice(
                this.currentIndex,
                this.currentIndex + nextBatchSize
            );

            await TTSHighlight.addToBatch(nextTexts, nextIds);

            this.currentIndex += nextBatchSize;

            logDebug(
                `TTSAudioManager: Refilled queue with ${nextBatchSize} items, ${this.currentQueue.length - this.currentIndex} remaining`
            );

            return true;
        } catch (error) {
            logError('TTSAudioManager: Failed to refill queue:', error);
            return false;
        }
    }

    async stop(): Promise<boolean> {
        try {
            await TTSHighlight.stop();

            this.isPlaying = false;
            this.currentQueue = [];
            this.currentUtteranceIds = [];
            this.currentIndex = 0;

            logDebug('TTSAudioManager: Playback stopped');
            return true;
        } catch (error) {
            logError('TTSAudioManager: Failed to stop playback:', error);
            return false;
        }
    }

    async getQueueSize(): Promise<number> {
        try {
            return await TTSHighlight.getQueueSize();
        } catch (error) {
            logError('TTSAudioManager: Failed to get queue size:', error);
            return 0;
        }
    }

    getProgress(): { current: number; total: number; percentage: number } {
        const total = this.currentQueue.length;
        const current = this.currentIndex;
        const percentage = total > 0 ? (current / total) * 100 : 0;

        return { current, total, percentage };
    }

    // Event handling
    onSpeechDone(callback: (utteranceId: string) => void) {
        this.onDoneCallback = callback;

        const subscription = ttsEmitter.addListener('onSpeechDone', (event) => {
            if (this.onDoneCallback) {
                this.onDoneCallback(event.utteranceId);
            }

            // Auto-refill queue
            this.refillQueue();
        });

        this.eventListeners.push(subscription);
    }

    /**
     * Called when the native TTS queue is completely empty.
     * This means all queued utterances have been spoken and the chapter has ended.
     * Use this to trigger next chapter loading when screen is off.
     */
    onQueueEmpty(callback: () => void) {
        this.onQueueEmptyCallback = callback;

        const subscription = ttsEmitter.addListener('onQueueEmpty', () => {
            logDebug('TTSAudioManager: Queue empty event received');
            if (this.onQueueEmptyCallback) {
                this.onQueueEmptyCallback();
            }
        });

        this.eventListeners.push(subscription);
    }

    onQueueLow(callback: () => void) {
        this._onQueueLowCallback = callback;
    }

    addListener(eventType: string, listener: (event: any) => void): EmitterSubscription {
        const subscription = ttsEmitter.addListener(eventType, listener);
        this.eventListeners.push(subscription);
        return subscription;
    }

    removeAllListeners() {
        this.eventListeners.forEach(subscription => subscription.remove());
        this.eventListeners = [];
        this.onDoneCallback = undefined;
        this.onQueueEmptyCallback = undefined;
        this._onQueueLowCallback = undefined;
    }

    isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }
}

export default new TTSAudioManager();
