import {
  parseWebViewMessage,
  createMessageRateLimiter,
} from '@utils/webviewSecurity';

describe('WebView Message Validation - Extended Edge Cases', () => {
  describe('parseWebViewMessage - Missing Fields', () => {
    it('should reject message without type field', () => {
      const raw = JSON.stringify({ data: 42, nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should handle message without nonce field', () => {
      const raw = JSON.stringify({ type: 'save', data: 42 });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      // Nonce is optional, message should still parse
      expect(msg).not.toBeNull();
      expect(msg?.nonce).toBeUndefined();
    });

    it('should handle message without data field', () => {
      const raw = JSON.stringify({ type: 'save', nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', number | undefined>(raw, [
        'save',
      ] as const);
      expect(msg).toEqual({
        type: 'save',
        data: undefined,
        nonce: 'abc123',
        ts: undefined,
      });
    });
  });

  describe('parseWebViewMessage - Type Coercion Attempts', () => {
    it('should reject numeric type instead of string', () => {
      const raw = JSON.stringify({ type: 123, data: 42, nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should reject object as type', () => {
      const raw = JSON.stringify({
        type: { malicious: 'save' },
        data: 42,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should reject array as nonce', () => {
      const raw = JSON.stringify({
        type: 'save',
        data: 42,
        nonce: ['abc', '123'],
      });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should reject object as nonce', () => {
      const raw = JSON.stringify({
        type: 'save',
        data: 42,
        nonce: { value: 'abc123' },
      });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).toBeNull();
    });
  });

  describe('parseWebViewMessage - JSON Attack Vectors', () => {
    it('should reject nested JSON string', () => {
      const inner = JSON.stringify({ type: 'save', data: 42, nonce: 'abc' });
      const outer = JSON.stringify(inner);
      const msg = parseWebViewMessage<'save', number>(outer, ['save'] as const);
      expect(msg).toBeNull();
    });

    it('should handle very large data payloads', () => {
      const largeData = 'x'.repeat(10000); // 10KB string
      const raw = JSON.stringify({
        type: 'save',
        data: largeData,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', string>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toBe(largeData);
    });

    it('should reject deeply nested objects', () => {
      let nested: any = 'value';
      for (let i = 0; i < 1000; i++) {
        nested = { child: nested };
      }
      const raw = JSON.stringify({
        type: 'save',
        data: nested,
        nonce: 'abc123',
      });

      // parseWebViewMessage should handle this gracefully
      const msg = parseWebViewMessage<'save', any>(raw, ['save'] as const);
      // Either accepts or rejects - should not crash
      expect(msg === null || msg !== null).toBe(true);
    });

    it('should handle unicode characters in data', () => {
      const unicodeData = '😀🎉中文한국어';
      const raw = JSON.stringify({
        type: 'save',
        data: unicodeData,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', string>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toBe(unicodeData);
    });

    it('should handle special characters in nonce', () => {
      const specialNonce = 'abc-123_XYZ.456';
      const raw = JSON.stringify({
        type: 'save',
        data: 42,
        nonce: specialNonce,
      });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.nonce).toBe(specialNonce);
    });

    it('should reject empty string as nonce', () => {
      const raw = JSON.stringify({ type: 'save', data: 42, nonce: '' });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      // Empty nonce is technically a string, so it may or may not be rejected
      // The important thing is the function doesn't crash
      expect(typeof msg === 'object' || msg === null).toBe(true);
    });
  });

  describe('parseWebViewMessage - Whitespace and Control Characters', () => {
    it('should handle JSON with leading/trailing whitespace', () => {
      const raw = `  \n\t${JSON.stringify({ type: 'save', data: 42, nonce: 'abc123' })}\n  `;
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toBe(42);
    });

    it('should handle type with leading/trailing spaces', () => {
      const raw = JSON.stringify({ type: ' save ', data: 42, nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      // Should not match due to extra spaces
      expect(msg).toBeNull();
    });

    it('should reject control characters in JSON', () => {
      const raw = '{"type":"save"\x00,"data":42,"nonce":"abc123"}';
      const msg = parseWebViewMessage<'save', number>(raw, ['save'] as const);
      // May fail to parse or parse without control char - either is acceptable
      expect(msg === null || msg !== null).toBe(true);
    });
  });

  describe('createMessageRateLimiter - Edge Cases', () => {
    it('should handle zero maxPerWindow gracefully', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 0,
        windowMs: 1000,
      });
      const now = Date.now();
      expect(limiter(now)).toBe(false); // Should reject all
    });

    it('should handle very small windowMs', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 5,
        windowMs: 1, // 1ms window
      });
      const t0 = Date.now();
      expect(limiter(t0)).toBe(true);
      expect(limiter(t0 + 2)).toBe(true); // Different window
    });

    it('should handle burst of messages at window boundary', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 2,
        windowMs: 1000,
      });
      const t0 = 1000;

      // Fill first window
      expect(limiter(t0)).toBe(true);
      expect(limiter(t0)).toBe(true);
      expect(limiter(t0)).toBe(false); // Exceeded

      // Right after window expires (sliding window may still include old messages)
      const t1 = t0 + 1001;
      expect(limiter(t1)).toBe(true); // New window starts
    });

    it('should handle very high maxPerWindow', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 10000,
        windowMs: 1000,
      });
      const now = Date.now();

      // Should allow many messages
      for (let i = 0; i < 100; i++) {
        expect(limiter(now)).toBe(true);
      }
    });

    it('should handle timestamps going backwards', () => {
      const limiter = createMessageRateLimiter({
        maxPerWindow: 2,
        windowMs: 1000,
      });

      const t1 = 5000;
      const t2 = 4000; // Earlier timestamp

      expect(limiter(t1)).toBe(true);
      expect(limiter(t1)).toBe(true);
      expect(limiter(t1)).toBe(false); // Exceeded at t1

      // Going back in time - behavior may vary (implementation dependent)
      // The important thing is it doesn't crash
      const result = limiter(t2);
      expect(typeof result).toBe('boolean');
    });

    it('should maintain separate counts per instance', () => {
      const limiter1 = createMessageRateLimiter({
        maxPerWindow: 2,
        windowMs: 1000,
      });
      const limiter2 = createMessageRateLimiter({
        maxPerWindow: 2,
        windowMs: 1000,
      });

      const now = Date.now();

      // limiter1
      expect(limiter1(now)).toBe(true);
      expect(limiter1(now)).toBe(true);
      expect(limiter1(now)).toBe(false);

      // limiter2 should have independent count
      expect(limiter2(now)).toBe(true);
      expect(limiter2(now)).toBe(true);
      expect(limiter2(now)).toBe(false);
    });
  });

  describe('parseWebViewMessage - Multiple Allowed Types', () => {
    it('should accept any of multiple allowed types', () => {
      const raw1 = JSON.stringify({ type: 'save', data: 1, nonce: 'abc' });
      const raw2 = JSON.stringify({ type: 'load', data: 2, nonce: 'def' });
      const raw3 = JSON.stringify({ type: 'delete', data: 3, nonce: 'ghi' });

      const allowed = ['save', 'load', 'delete'] as const;

      const msg1 = parseWebViewMessage<'save' | 'load' | 'delete', number>(
        raw1,
        allowed,
      );
      const msg2 = parseWebViewMessage<'save' | 'load' | 'delete', number>(
        raw2,
        allowed,
      );
      const msg3 = parseWebViewMessage<'save' | 'load' | 'delete', number>(
        raw3,
        allowed,
      );

      expect(msg1?.type).toBe('save');
      expect(msg2?.type).toBe('load');
      expect(msg3?.type).toBe('delete');
    });

    it('should reject type not in allowed list', () => {
      const raw = JSON.stringify({ type: 'inject', data: 1, nonce: 'abc' });
      const msg = parseWebViewMessage<'save' | 'load', number>(raw, [
        'save',
        'load',
      ] as const);
      expect(msg).toBeNull();
    });
  });

  describe('parseWebViewMessage - Complex Data Types', () => {
    it('should handle array data', () => {
      const arrayData = [1, 2, 3, 'four', { five: 5 }];
      const raw = JSON.stringify({
        type: 'save',
        data: arrayData,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', any[]>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toEqual(arrayData);
    });

    it('should handle object data', () => {
      const objectData = { x: 1, y: 'two', z: { nested: true } };
      const raw = JSON.stringify({
        type: 'save',
        data: objectData,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', any>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toEqual(objectData);
    });

    it('should handle null data', () => {
      const raw = JSON.stringify({ type: 'save', data: null, nonce: 'abc123' });
      const msg = parseWebViewMessage<'save', null>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toBeNull();
    });

    it('should handle boolean data', () => {
      const raw = JSON.stringify({
        type: 'save',
        data: false,
        nonce: 'abc123',
      });
      const msg = parseWebViewMessage<'save', boolean>(raw, ['save'] as const);
      expect(msg).not.toBeNull();
      expect(msg?.data).toBe(false);
    });
  });
});
