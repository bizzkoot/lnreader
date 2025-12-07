#!/usr/bin/env node
/**
 * TTS Wake Cycle Queue Validation Simulator
 * 
 * This script simulates the TTS paragraph repetition/skip bug scenario:
 * 1. Multiple screen off/on cycles while TTS is playing
 * 2. Each wake creates a new speakBatch with ttsQueueRef updated
 * 3. Screen tap triggers WebView to send new tts-queue messages
 * 4. Validates that the queue validation logic correctly rejects stale queues
 * 
 * Run with: pnpm test:tts-wake-cycle
 */

const PARAGRAPH_COUNT = 60;
const BATCH_SIZE = 25;

// Simulate ref-like behavior
class RefSimulator {
    constructor(initialValue) {
        this.current = initialValue;
    }
}

// Mock TTS state
const state = {
    currentParagraphIndexRef: new RefSimulator(-1),
    ttsQueueRef: new RefSimulator(null),
    ttsSessionRef: new RefSimulator(0),
    wakeResumeGracePeriodRef: new RefSimulator(0),
    wakeTransitionInProgressRef: new RefSimulator(false),
};

// Generate mock paragraphs
const generateParagraphs = (count) =>
    Array(count).fill(0).map((_, i) => `Paragraph ${i}`);

// Simulate speakBatch on wake resume
function simulateWakeResume(paragraphs, startIndex) {
    console.log(`\n[WAKE ${state.ttsSessionRef.current + 1}] Screen wake detected at paragraph ${startIndex}`);

    // Clear stale queue at start of wake transition
    state.wakeTransitionInProgressRef.current = true;
    state.ttsQueueRef.current = null;
    state.ttsSessionRef.current += 1;

    console.log(`  Session incremented to ${state.ttsSessionRef.current}, queue cleared`);

    // Simulate async pause/sync
    const capturedIndex = startIndex;
    state.currentParagraphIndexRef.current = capturedIndex;

    // Simulate speakBatch creating new queue
    const remaining = paragraphs.slice(startIndex);
    state.ttsQueueRef.current = {
        startIndex: startIndex,
        texts: remaining.slice(0, BATCH_SIZE),
    };

    // Set grace period
    state.wakeResumeGracePeriodRef.current = Date.now();
    state.wakeTransitionInProgressRef.current = false;

    console.log(`  New queue: startIndex=${state.ttsQueueRef.current.startIndex}, ` +
        `length=${state.ttsQueueRef.current.texts.length}`);

    return true;
}

// Simulate onSpeechDone handler
function simulateOnSpeechDone() {
    // BUG FIX: Block during wake transition
    if (state.wakeTransitionInProgressRef.current) {
        console.log('  onSpeechDone: BLOCKED (wake transition in progress)');
        return { blocked: true, reason: 'wake_transition' };
    }

    if (!state.ttsQueueRef.current || state.currentParagraphIndexRef.current < 0) {
        console.log('  onSpeechDone: No queue, deferring to WebView');
        return { blocked: false, deferred: true };
    }

    const currentIdx = state.currentParagraphIndexRef.current;
    const queueStart = state.ttsQueueRef.current.startIndex;
    const queueEnd = queueStart + state.ttsQueueRef.current.texts.length;

    // Validate bounds
    if (currentIdx < queueStart) {
        console.log(`  onSpeechDone: currentIdx ${currentIdx} < queueStart ${queueStart}, deferring`);
        return { blocked: true, reason: 'index_behind_queue' };
    }

    if (currentIdx >= queueEnd) {
        console.log(`  onSpeechDone: currentIdx ${currentIdx} >= queueEnd ${queueEnd}, need new queue`);
        return { blocked: true, reason: 'index_past_queue' };
    }

    const nextIndex = currentIdx + 1;

    // Check monotonic progression
    if (nextIndex <= state.currentParagraphIndexRef.current) {
        console.log(`  onSpeechDone: WARNING - Index not advancing! next=${nextIndex}`);
    }

    state.currentParagraphIndexRef.current = nextIndex;
    console.log(`  onSpeechDone: Advanced to ${nextIndex} (queue: ${queueStart}-${queueEnd - 1})`);

    return { blocked: false, newIndex: nextIndex };
}

// Simulate tts-queue message from WebView (stale)
function simulateStaleTtsQueue(startIndex, paragraphs) {
    console.log(`\n[WebView] Sending tts-queue from index ${startIndex}`);

    const currentIdx = state.currentParagraphIndexRef.current;
    const timeSinceWakeResume = Date.now() - state.wakeResumeGracePeriodRef.current;

    // BUG FIX: Wake resume grace period
    if (timeSinceWakeResume < 500 && state.wakeResumeGracePeriodRef.current > 0) {
        console.log(`  REJECTED: Wake grace period (${timeSinceWakeResume}ms < 500ms)`);
        return { accepted: false, reason: 'wake_grace_period' };
    }

    // BUG FIX: Reject stale queues
    if (currentIdx >= 0 && startIndex < currentIdx) {
        console.log(`  REJECTED: Stale queue (starts at ${startIndex}, currently at ${currentIdx})`);
        return { accepted: false, reason: 'stale_queue' };
    }

    // Gap detection
    if (currentIdx >= 0 && startIndex > currentIdx + 1) {
        console.log(`  WARNING: Queue gap detected (starts at ${startIndex}, currently at ${currentIdx})`);
    }

    console.log(`  ACCEPTED: Queue from ${startIndex} (current: ${currentIdx})`);
    state.ttsQueueRef.current = {
        startIndex: startIndex,
        texts: paragraphs.slice(startIndex, startIndex + BATCH_SIZE),
    };

    return { accepted: true };
}

// Run test scenarios
function runTests() {
    const paragraphs = generateParagraphs(PARAGRAPH_COUNT);
    let testsPassed = 0;
    let testsFailed = 0;

    console.log('='.repeat(60));
    console.log('TTS Wake Cycle Queue Validation Tests');
    console.log('='.repeat(60));

    // Test 1: Normal wake resume
    console.log('\n[TEST 1] Normal wake resume from paragraph 10');
    simulateWakeResume(paragraphs, 10);
    const result1 = simulateOnSpeechDone();
    if (!result1.blocked && result1.newIndex === 11) {
        console.log('✓ PASS: Normal progression works');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Normal progression failed');
        testsFailed++;
    }

    // Test 2: Multiple wake cycles
    console.log('\n[TEST 2] Multiple wake cycles');
    simulateWakeResume(paragraphs, 10);
    simulateWakeResume(paragraphs, 20);
    simulateWakeResume(paragraphs, 30);
    if (state.ttsSessionRef.current === 4 &&
        state.ttsQueueRef.current.startIndex === 30) {
        console.log('✓ PASS: Multiple wakes tracked correctly, queue is fresh');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Session or queue incorrect');
        testsFailed++;
    }

    // Test 3: Stale WebView queue rejection
    console.log('\n[TEST 3] Stale WebView queue rejection');
    simulateWakeResume(paragraphs, 30);
    // Advance a few paragraphs
    state.currentParagraphIndexRef.current = 35;
    // Clear grace period to test stale rejection
    state.wakeResumeGracePeriodRef.current = Date.now() - 1000;

    const staleResult = simulateStaleTtsQueue(25, paragraphs);
    if (!staleResult.accepted && staleResult.reason === 'stale_queue') {
        console.log('✓ PASS: Stale queue correctly rejected');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Stale queue was not rejected');
        testsFailed++;
    }

    // Test 4: Wake grace period blocks WebView queue
    console.log('\n[TEST 4] Wake grace period blocks WebView queue');
    simulateWakeResume(paragraphs, 40);
    // Try to send queue immediately (within grace period)
    const graceResult = simulateStaleTtsQueue(41, paragraphs);
    if (!graceResult.accepted && graceResult.reason === 'wake_grace_period') {
        console.log('✓ PASS: Queue during grace period correctly blocked');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Queue during grace period was not blocked');
        testsFailed++;
    }

    // Test 5: Valid queue after grace period
    console.log('\n[TEST 5] Valid queue after grace period');
    simulateWakeResume(paragraphs, 45);
    state.wakeResumeGracePeriodRef.current = Date.now() - 600; // Past grace
    const validResult = simulateStaleTtsQueue(46, paragraphs);
    if (validResult.accepted) {
        console.log('✓ PASS: Valid queue accepted after grace period');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Valid queue was rejected');
        testsFailed++;
    }

    // Test 6: onSpeechDone blocked during wake transition
    console.log('\n[TEST 6] onSpeechDone blocked during wake transition');
    state.wakeTransitionInProgressRef.current = true;
    const blockedResult = simulateOnSpeechDone();
    state.wakeTransitionInProgressRef.current = false;
    if (blockedResult.blocked && blockedResult.reason === 'wake_transition') {
        console.log('✓ PASS: onSpeechDone correctly blocked during wake transition');
        testsPassed++;
    } else {
        console.log('✗ FAIL: onSpeechDone was not blocked');
        testsFailed++;
    }

    // Test 7: Index past queue bounds
    console.log('\n[TEST 7] Index past queue bounds');
    simulateWakeResume(paragraphs, 50);
    // Set current index past queue end
    state.currentParagraphIndexRef.current = 50 + BATCH_SIZE + 5;
    const pastResult = simulateOnSpeechDone();
    if (pastResult.blocked && pastResult.reason === 'index_past_queue') {
        console.log('✓ PASS: Index past queue correctly handled');
        testsPassed++;
    } else {
        console.log('✗ FAIL: Index past queue not handled');
        testsFailed++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('='.repeat(60));

    if (testsFailed > 0) {
        process.exit(1);
    } else {
        console.log('\n✓ All tests passed! TTS wake cycle validation logic is working correctly.');
        process.exit(0);
    }
}

// Run
runTests();
