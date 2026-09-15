import { describe, expect, it } from 'vitest';
import { advanceReviewSession } from './ReviewPage';

describe('review session queue', () => {
  it('removes the answered question and keeps the next question active', () => {
    const result = advanceReviewSession({ items: [{ id: 20 }, { id: 21 }, { id: 22 }], index: 1 }, 21);

    expect(result.items.map((question) => question.id)).toEqual([20, 22]);
    expect(result.items[result.index].id).toBe(22);
  });

  it('returns an empty completion state after the final answer', () => {
    const result = advanceReviewSession({ items: [{ id: 20 }], index: 0 }, 20);

    expect(result).toEqual({ items: [], index: 0 });
  });

  it('places a question marked 不会 after three other questions', () => {
    const result = advanceReviewSession({
      items: [{ id: 20 }, { id: 21 }, { id: 22 }, { id: 23 }, { id: 24 }],
      index: 0,
    }, 20, 'again');

    expect(result.items.map((question) => question.id)).toEqual([21, 22, 23, 20, 24]);
    expect(result.items[result.index].id).toBe(21);
  });

  it('keeps a lone 不会 question in the session for immediate reinforcement', () => {
    const result = advanceReviewSession({ items: [{ id: 20 }], index: 0 }, 20, 'again');

    expect(result).toEqual({ items: [{ id: 20 }], index: 0 });
  });
});
