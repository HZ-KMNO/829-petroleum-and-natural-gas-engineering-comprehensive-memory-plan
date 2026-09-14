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
});
