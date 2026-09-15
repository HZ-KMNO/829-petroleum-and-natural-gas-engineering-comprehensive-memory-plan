import { describe, expect, it } from 'vitest';
import { migrateQuestionNumbers, normalizeStudyState } from './storage';

describe('study state normalization', () => {
  it('repairs null collections and invalid settings from older saves', () => {
    const state = normalizeStudyState({
      progress: null,
      priorities: [],
      history: 'broken',
      settings: null,
      migrations: null,
    });

    expect(state.progress).toEqual({});
    expect(state.priorities).toEqual({});
    expect(state.history).toEqual({});
    expect(state.dailyTargets).toEqual({});
    expect(state.settings.dailyNew).toBe(20);
    expect(state.settings.defaultDailyTarget).toBe(40);
    expect(state.migrations).toEqual({});
  });

  it('normalizes saved daily targets and their default', () => {
    const state = normalizeStudyState({
      dailyTargets: {
        '2026-09-14': '32',
        '2026-09-15': 500,
        invalid: 12,
      },
      settings: { defaultDailyTarget: 0 },
    });

    expect(state.dailyTargets).toEqual({
      '2026-09-14': 32,
      '2026-09-15': 369,
    });
    expect(state.settings.defaultDailyTarget).toBe(1);
  });

  it('normalizes missing and non-numeric review counters', () => {
    const state = normalizeStudyState({
      history: {
        '2026-09-10': { reviewed: '10', good: undefined, hard: 'bad' },
      },
    });

    expect(state.history['2026-09-10']).toMatchObject({
      reviewed: 10,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    });
  });

  it('preserves unique question counts separately from repeated attempts', () => {
    const state = normalizeStudyState({
      history: {
        '2026-09-14': {
          reviewed: 3,
          attempts: 5,
          reviewedQuestionIds: [20, '20', 21, 'invalid'],
        },
      },
    });

    expect(state.history['2026-09-14']).toMatchObject({
      reviewed: 3,
      attempts: 5,
      reviewedQuestionIds: ['20', '21'],
    });
  });

  it('renumbers legacy question progress without rewriting aggregate study history', () => {
    const history = { '2026-09-10': { reviewed: 3, good: 3 } };
    const state = migrateQuestionNumbers({
      progress: {
        41: { attempts: 1 }, 42: { attempts: 2 }, 43: { attempts: 3 },
        44: { attempts: 4 }, 226: { attempts: 5 }, 227: { attempts: 6 },
        228: { attempts: 7 }, 372: { attempts: 8 },
      },
      priorities: { 41: 'A', 42: 'B', 44: 'C', 227: 'A', 228: 'B', 372: 'C' },
      history,
      migrations: { questionDedupV1: true },
    });

    expect(state.progress).toEqual({
      41: { attempts: 1 }, 42: { attempts: 4 }, 224: { attempts: 5 },
      225: { attempts: 7 }, 369: { attempts: 8 },
    });
    expect(state.priorities).toEqual({ 41: 'A', 42: 'C', 225: 'B', 369: 'C' });
    expect(state.history).toBe(history);
    expect(state.migrations).toEqual({
      questionDedupV1: true,
      questionBankCleanupV2: true,
      questionRenumberV3: true,
    });
  });

  it('does not remap valid current numbers more than once', () => {
    const state = migrateQuestionNumbers({
      progress: { 42: { attempts: 1 }, 43: { attempts: 2 }, 227: { attempts: 3 } },
      priorities: { 42: 'A', 43: 'B', 227: 'C' },
      migrations: { questionRenumberV3: true },
    });

    expect(state.progress).toEqual({
      42: { attempts: 1 }, 43: { attempts: 2 }, 227: { attempts: 3 },
    });
    expect(state.priorities).toEqual({ 42: 'A', 43: 'B', 227: 'C' });
  });
});
