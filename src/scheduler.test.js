import { describe, expect, it } from 'vitest';
import { buildTodayQueue, gradeQuestion, toDateKey } from './scheduler';

describe('scheduler', () => {
  it('advances a new question through the learning steps', () => {
    const today = new Date('2026-09-01T08:00:00');
    const result = gradeQuestion({}, 'good', today);
    expect(result.interval).toBe(1);
    expect(result.due).toBe('2026-09-02');
  });

  it('resets forgotten questions and records lapses', () => {
    const result = gradeQuestion({ step: 3, interval: 14, lapses: 1 }, 'again', new Date('2026-09-01'));
    expect(result.step).toBe(0);
    expect(result.lapses).toBe(2);
  });

  it('places due reviews before new cards', () => {
    const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const progress = { 2: { due: '2026-09-01' } };
    const queue = buildTodayQueue(questions, progress, 1, new Date('2026-09-01'));
    expect(queue.map((item) => item.id)).toEqual([2, 1]);
  });

  it('prioritizes A cards within the same queue group', () => {
    const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const queue = buildTodayQueue(questions, {}, 3, new Date('2026-09-01'), { 3: 'A', 1: 'C' });
    expect(queue.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('formats local dates without UTC drift', () => {
    expect(toDateKey(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01');
  });
});
