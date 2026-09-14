import { describe, expect, it } from 'vitest';
import { addProfile, normalizeProfileStore, validatePlayerName } from './profiles';
describe('player profiles', () => {
  it('normalizes display names without requiring a password', () => {
    expect(validatePlayerName('  小 明  ')).toBe('小 明');
    expect(() => validatePlayerName('')).toThrow();
    expect(() => validatePlayerName('player/one')).toThrow();
  });

  it('migrates legacy local accounts into selectable profiles', () => {
    const store = normalizeProfileStore(null, {
      accounts: {
        小明: { username: '小明', createdAt: '2026-09-01T00:00:00.000Z' },
        Alex: { username: 'Alex', createdAt: '2026-09-02T00:00:00.000Z' },
      },
    });

    expect(store.profiles.map((profile) => profile.username)).toEqual(['小明', 'Alex']);
    expect(store.profiles.every((profile) => profile.avatar)).toBe(true);
  });

  it('recovers an orphaned player when its save exists without a profile index', () => {
    const store = normalizeProfileStore(null, null, ['hz']);

    expect(store.profiles).toEqual([
      expect.objectContaining({ username: 'hz', avatar: 'compass' }),
    ]);
  });

  it('merges discovered saves without duplicating an indexed player', () => {
    const store = normalizeProfileStore({
      version: 1,
      profiles: [{ username: 'hz', avatar: 'book', createdAt: '2026-09-01T00:00:00.000Z' }],
    }, null, ['HZ', 'new-player']);

    expect(store.profiles.map((profile) => profile.username)).toEqual(['hz', 'new-player']);
    expect(store.profiles[0].avatar).toBe('book');
  });

  it('creates unique profiles with independent display identities', () => {
    const initial = { version: 1, profiles: [] };
    const [store, profile] = addProfile(initial, 'Explorer', 'compass');

    expect(profile).toMatchObject({ username: 'Explorer', avatar: 'compass' });
    expect(store.profiles).toHaveLength(1);
    expect(() => addProfile(store, 'explorer', 'book')).toThrow('这个玩家名称已经存在');
  });
});
