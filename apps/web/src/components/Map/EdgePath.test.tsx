import { describe, it, expect } from 'vitest';
import { sampleBezier } from './EdgePath';

describe('sampleBezier (EdgePath helper)', () => {
  it('returns count+1 points from start to end inclusive', () => {
    const pts = sampleBezier([0, 0], [0.5, 1], [1, 0], 10);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([1, 0]);
  });

  it('midpoint at t=0.5 follows the quadratic bezier formula', () => {
    const pts = sampleBezier([0, 0], [0.5, 1], [1, 0], 2);
    // At t=0.5, mid-sampled point = 0.25*from + 0.5*mid + 0.25*to
    // lat = 0.25*0 + 0.5*0.5 + 0.25*1 = 0.5
    // lng = 0.25*0 + 0.5*1 + 0.25*0 = 0.5
    expect(pts[1]![0]).toBeCloseTo(0.5);
    expect(pts[1]![1]).toBeCloseTo(0.5);
  });
});
