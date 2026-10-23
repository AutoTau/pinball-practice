import { formatScore, parseScore, scoreDigits, shortScore } from '@/domain/score';

describe('score helpers', () => {
  it('groups digits in threes', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(340_000_000)).toBe('340,000,000');
    expect(formatScore(12_345_678_901)).toBe('12,345,678,901');
  });

  it('keeps only digits from typed text and drops leading zeros', () => {
    expect(scoreDigits('340,000,0')).toBe('3400000');
    expect(scoreDigits('007')).toBe('7');
    expect(scoreDigits('0')).toBe('0');
    expect(scoreDigits('abc')).toBe('');
  });

  it('parses typed text into a score', () => {
    expect(parseScore('1,234')).toBe(1234);
    expect(parseScore('')).toBeNull();
  });

  it('shortens large scores', () => {
    expect(shortScore(950)).toBe('950');
    expect(shortScore(340_000_000)).toBe('340M');
    expect(shortScore(1_234_567_890)).toBe('1.23B');
    expect(shortScore(45_600)).toBe('45.6K');
  });
});
