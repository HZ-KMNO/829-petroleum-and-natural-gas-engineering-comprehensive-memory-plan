import { describe, expect, it } from 'vitest';
import { buildTodayQueue, gradeQuestion, questionWorkload, toDateKey } from './scheduler';

const question = (id, length, withImage = false) => ({
  id,
  blocks: [
    { type: 'paragraph', text: '题'.repeat(length), clozes: [] },
    ...(withImage ? [{ type: 'image' }] : []),
  ],
});

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
    const queue = buildTodayQueue(questions, progress, 2, new Date('2026-09-01'));
    expect(queue.map((item) => item.id)).toEqual([2, 1]);
  });

  it('prioritizes A cards within the same queue group', () => {
    const questions = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const queue = buildTodayQueue(questions, {}, 3, new Date('2026-09-01'), { 3: 'A', 1: 'C' });
    expect(queue.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  it('caps due and new questions together at the daily limit', () => {
    const questions = Array.from({ length: 60 }, (_, index) => ({ id: index + 1 }));
    const progress = Object.fromEntries(
      questions.slice(0, 25).map((question) => [question.id, { due: '2026-09-01' }]),
    );
    const queue = buildTodayQueue(questions, progress, 40, new Date('2026-09-01'));

    expect(queue).toHaveLength(40);
    expect(queue.slice(0, 25).map((item) => item.id)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    expect(queue.slice(25).map((item) => item.id)).toEqual(Array.from({ length: 15 }, (_, index) => index + 26));
  });

  it('never exceeds the daily limit when reviews alone exceed it', () => {
    const questions = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
    const progress = Object.fromEntries(
      questions.map((question) => [question.id, { due: '2026-09-01' }]),
    );

    expect(buildTodayQueue(questions, progress, 40, new Date('2026-09-01'))).toHaveLength(40);
  });

  it('selects equal numbers of short and long questions and alternates them', () => {
    const questions = [
      question(1, 10), question(2, 20), question(3, 30), question(4, 40),
      question(5, 100), question(6, 110), question(7, 120), question(8, 130),
    ];
    const queue = buildTodayQueue(questions, {}, 4, new Date('2026-09-01'));

    expect(queue.map((item) => item.id)).toEqual([1, 5, 2, 6]);
  });

  it('counts image questions as additional learning workload', () => {
    expect(questionWorkload(question(1, 20, true))).toBe(100);
  });

  it('fills the daily limit when one length group has too few questions', () => {
    const questions = [question(1, 10), question(2, 100), question(3, 110), question(4, 120)];
    const queue = buildTodayQueue(questions, {}, 4, new Date('2026-09-01'));

    expect(queue).toHaveLength(4);
    expect(new Set(queue.map((item) => item.id)).size).toBe(4);
  });

  it('formats local dates without UTC drift', () => {
    expect(toDateKey(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01');
  });
});
