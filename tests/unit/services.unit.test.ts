import { describe, it, expect } from 'vitest';
import { computeReadingTime } from '@/server/services/posts';

/**
 * Pure unit tests — no DB. Reading-time is a business rule (words / 200, floor 1)
 * the editor and the post view both surface, so a regression here is user-visible.
 */
describe('computeReadingTime (pure)', () => {
  it('returns 1 minute for empty / whitespace-only bodies (never 0)', () => {
    expect(computeReadingTime('')).toBe(1);
    expect(computeReadingTime('   \n  \t ')).toBe(1);
  });

  it('returns 1 minute for a short body', () => {
    expect(computeReadingTime('just a few words here')).toBe(1);
  });

  it('scales at ~200 words per minute (rounded, min 1)', () => {
    const word = 'lorem ';
    expect(computeReadingTime(word.repeat(200).trim())).toBe(1); // 200 words -> 1
    expect(computeReadingTime(word.repeat(400).trim())).toBe(2); // 400 words -> 2
    expect(computeReadingTime(word.repeat(500).trim())).toBe(3); // 500 -> round(2.5)=3
  });

  it('collapses arbitrary whitespace runs when counting words', () => {
    expect(computeReadingTime('one\n\ntwo\t\tthree    four')).toBe(1);
  });
});
