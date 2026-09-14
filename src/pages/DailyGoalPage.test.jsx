import { describe, expect, it } from 'vitest';
import { clampDailyGoal } from './DailyGoalPage';

describe('daily study target', () => {
  it('accepts a typed whole-number target', () => {
    expect(clampDailyGoal('36', 1, 369)).toBe(36);
  });

  it('keeps the target within the available range', () => {
    expect(clampDailyGoal('', 1, 369)).toBe(1);
    expect(clampDailyGoal(0, 1, 369)).toBe(1);
    expect(clampDailyGoal(500, 1, 369)).toBe(369);
    expect(clampDailyGoal(12.9, 1, 369)).toBe(12);
  });

  it('never lowers the target below work already completed today', () => {
    expect(clampDailyGoal(5, 14, 369)).toBe(14);
  });
});
