import { median, percentile, rollingMedian, shares } from '@/domain/stats';

describe('stats', () => {
  it('takes the median of odd and even counts', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('is not dragged by one huge game the way an average is', () => {
    const scores = [100, 110, 120, 130, 5000];
    expect(median(scores)).toBe(120);
  });

  it('interpolates percentiles', () => {
    const v = [10, 20, 30, 40, 50];
    expect(percentile(v, 0)).toBe(10);
    expect(percentile(v, 25)).toBe(20);
    expect(percentile(v, 75)).toBe(40);
    expect(percentile(v, 90)).toBe(46);
    expect(percentile(v, 100)).toBe(50);
  });

  it('computes a rolling median over a trailing window', () => {
    expect(rollingMedian([10, 30, 20, 100, 40], 3)).toEqual([10, 20, 20, 30, 40]);
  });

  it('ranks shares by frequency', () => {
    expect(shares(['a', 'b', 'a', 'c', 'a', 'b'])).toEqual([
      { key: 'a', count: 3, share: 0.5 },
      { key: 'b', count: 2, share: 2 / 6 },
      { key: 'c', count: 1, share: 1 / 6 },
    ]);
  });
});
