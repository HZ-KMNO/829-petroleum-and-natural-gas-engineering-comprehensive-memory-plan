import { describe, expect, it } from 'vitest';
import {
  buildDailyPlan,
  buildTodayQueue,
  dailyTarget,
  gradeQuestion,
  questionWorkload,
  toDateKey,
} from './scheduler';

const question = (id, length = 0, withImage = false, chapter = 1) => ({
  id,
  chapter: { number: chapter },
  blocks: [
    { type: 'paragraph', text: '题'.repeat(length), clozes: [] },
    ...(withImage ? [{ type: 'image' }] : []),
  ],
});

describe('FSRS review scheduling', () => {
  it('maps the three feedback levels to increasingly longer first intervals', () => {
    const today = new Date('2026-09-01T08:00:00');
    const again = gradeQuestion({}, 'again', today);
    const hard = gradeQuestion({}, 'hard', today);
    const good = gradeQuestion({}, 'good', today);

    expect(again.interval).toBe(1);
    expect(hard.interval).toBeGreaterThan(again.interval);
    expect(good.interval).toBeGreaterThan(hard.interval);
    expect(good.due).toBe('2026-09-04');
    expect(good.fsrs.stability).toBeGreaterThan(hard.fsrs.stability);
  });

  it('resets a forgotten review and records a lapse', () => {
    const result = gradeQuestion({
      step: 3,
      interval: 14,
      attempts: 4,
      lapses: 1,
      lastReviewed: '2026-08-18',
      due: '2026-09-01',
    }, 'again', new Date('2026-09-01'));

    expect(result.step).toBe(0);
    expect(result.lapses).toBe(2);
    expect(result.interval).toBeGreaterThanOrEqual(1);
    expect(result.fsrs).toBeTruthy();
  });

  it('converts an old progress record without resetting its counters', () => {
    const result = gradeQuestion({
      interval: 7,
      attempts: 8,
      lapses: 2,
      lastReviewed: '2026-08-25',
      due: '2026-09-01',
    }, 'hard', new Date('2026-09-01'));

    expect(result.attempts).toBe(9);
    expect(result.lapses).toBe(2);
    expect(result.fsrs.reps).toBeGreaterThanOrEqual(8);
    expect(result.due >= '2026-09-02').toBe(true);
  });
});

describe('daily review planning', () => {
  it('selects due reviews before allocating places to new questions', () => {
    const questions = [question(1), question(2), question(3)];
    const progress = { 2: { due: '2026-09-01' } };
    const plan = buildDailyPlan(questions, progress, 2, new Date('2026-09-01'));

    expect(plan.queue.map((item) => item.id)).toEqual([2, 1]);
    expect(plan.dueCount).toBe(1);
    expect(plan.newCount).toBe(1);
  });

  it('prioritizes high-risk overdue reviews', () => {
    const questions = [question(1), question(2), question(3)];
    const progress = {
      1: { due: '2026-09-01', interval: 30, attempts: 3, lastReviewed: '2026-08-02' },
      2: { due: '2026-08-20', interval: 3, attempts: 3, lapses: 2, lastGrade: 'again', lastReviewed: '2026-08-17' },
      3: { due: '2026-09-01', interval: 7, attempts: 3, lastReviewed: '2026-08-25' },
    };

    const queue = buildTodayQueue(questions, progress, 2, new Date('2026-09-01'));
    expect(queue[0].id).toBe(2);
    expect(new Set(queue.map((item) => item.id)).size).toBe(2);
  });

  it('uses A, B and C priorities when memory risk is otherwise equal', () => {
    const questions = [question(1), question(2), question(3)];
    const queue = buildTodayQueue(questions, {}, 3, new Date('2026-09-01'), { 3: 'A', 1: 'C' });
    expect(queue.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('caps due and new questions together and interleaves both groups', () => {
    const questions = Array.from({ length: 60 }, (_, index) => question(index + 1));
    const progress = Object.fromEntries(
      questions.slice(0, 25).map((item) => [item.id, { due: '2026-09-01' }]),
    );
    const plan = buildDailyPlan(questions, progress, 40, new Date('2026-09-01'));

    expect(plan.queue).toHaveLength(40);
    expect(plan.dueCount).toBe(25);
    expect(plan.newCount).toBe(15);
    expect(plan.queue[0].id).toBeLessThanOrEqual(25);
    expect(plan.queue.slice(0, 10).some((item) => item.id > 25)).toBe(true);
    expect(new Set(plan.queue.map((item) => item.id).filter((id) => id <= 25)).size).toBe(25);
  });

  it('reports review backlog when due questions exceed the daily target', () => {
    const questions = Array.from({ length: 50 }, (_, index) => question(index + 1));
    const progress = Object.fromEntries(
      questions.map((item) => [item.id, { due: '2026-09-01' }]),
    );
    const plan = buildDailyPlan(questions, progress, 40, new Date('2026-09-01'));

    expect(plan.queue).toHaveLength(40);
    expect(plan.newCount).toBe(0);
    expect(plan.deferredDueCount).toBe(10);
  });

  it('alternates short and long questions within the risk order', () => {
    const questions = [
      question(1, 10), question(2, 20), question(3, 30), question(4, 40),
      question(5, 100), question(6, 110), question(7, 120), question(8, 130),
    ];
    const queue = buildTodayQueue(questions, {}, 4, new Date('2026-09-01'));

    expect(queue.map((item) => item.id)).toEqual([1, 5, 2, 6]);
  });

  it('avoids adjacent questions from the same chapter when possible', () => {
    const questions = [question(1, 10, false, 1), question(2, 20, false, 1), question(3, 30, false, 2)];
    const queue = buildTodayQueue(questions, {}, 3, new Date('2026-09-01'));

    expect(queue.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it('counts image questions as additional learning workload', () => {
    expect(questionWorkload(question(1, 20, true))).toBe(100);
  });

  it('reserves consolidation days when recommending a daily target', () => {
    const target = dailyTarget(369, 369, new Date('2026-10-01'), new Date('2026-09-01'), 5);
    expect(target).toBe(22);
  });

  it('formats local dates without UTC drift', () => {
    expect(toDateKey(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01');
  });
});
