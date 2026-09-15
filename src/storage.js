import { useCallback, useEffect, useState } from 'react';
import { addDays, toDateKey } from './scheduler';
import { addProfile, normalizeProfileStore } from './profiles';

// The QA build used a separate key in the same Electron user-data directory.
// Keep it as a read-compatible source so reinstalling or launching a build
// with a query flag never hides an existing player save.
const STORAGE_KEYS = ['829-memory-state-v1', '829-memory-state-qa-v1'];
const STORAGE_KEY = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa')
  ? '829-memory-state-qa-v1'
  : '829-memory-state-v1';
const PROFILE_KEY = '829-memory-profiles-v1';
const LEGACY_AUTH_KEY = '829-memory-auth-v1';
const LEGACY_CLAIM_KEY = '829-memory-legacy-save-claimed-v1';

function userStorageKey(username) {
  return `${STORAGE_KEY}:user:${encodeURIComponent(username)}`;
}

function userStorageKeys(username) {
  const encoded = encodeURIComponent(username);
  return [STORAGE_KEY, ...STORAGE_KEYS.filter((key) => key !== STORAGE_KEY)]
    .map((key) => `${key}:user:${encoded}`);
}

function readFirstJson(keys) {
  for (const key of keys) {
    const value = readJson(key);
    if (value) return { key, value };
  }
  return { key: null, value: null };
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function discoverStoredProfileNames() {
  const prefixes = STORAGE_KEYS.map((key) => `${key}:user:`);
  const names = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const prefix = prefixes.find((candidate) => key?.startsWith(candidate));
    if (!prefix) continue;
    try {
      names.push(decodeURIComponent(key.slice(prefix.length)));
    } catch {
      // Ignore a malformed foreign key without hiding other valid saves.
    }
  }
  return names;
}

function readProfileStore() {
  const saved = readJson(PROFILE_KEY);
  const store = normalizeProfileStore(
    saved,
    readJson(LEGACY_AUTH_KEY),
    discoverStoredProfileNames(),
  );
  if (store.profiles.length && JSON.stringify(saved) !== JSON.stringify(store)) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(store));
  }
  return store;
}

export function useProfiles() {
  const [store, setStore] = useState(() => readProfileStore());
  const [activeUsername, setActiveUsername] = useState('');
  const [hasLegacySave, setHasLegacySave] = useState(() => (
    STORAGE_KEYS.some((key) => Boolean(localStorage.getItem(key)))
      && !localStorage.getItem(LEGACY_CLAIM_KEY)
  ));

  const createProfile = useCallback((name, avatar, options = {}) => {
    const current = readProfileStore();
    const [next, profile] = addProfile(current, name, avatar);
    const legacy = readFirstJson(STORAGE_KEYS).value;
    if (options.migrateLegacy && legacy && !localStorage.getItem(userStorageKey(profile.username))) {
      localStorage.setItem(userStorageKey(profile.username), JSON.stringify(legacy));
      localStorage.setItem(LEGACY_CLAIM_KEY, '1');
      setHasLegacySave(false);
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setStore(next);
    setActiveUsername(profile.username);
    return profile;
  }, []);

  const selectProfile = useCallback((username) => {
    const current = readProfileStore();
    if (!current.profiles.some((profile) => profile.username === username)) return;
    setStore(current);
    setActiveUsername(username);
  }, []);

  const leaveProfile = useCallback(() => setActiveUsername(''), []);
  const activeProfile = store.profiles.find((profile) => profile.username === activeUsername) ?? null;

  return {
    profiles: store.profiles,
    hasLegacySave,
    activeProfile,
    createProfile,
    selectProfile,
    leaveProfile,
  };
}

export function defaultState() {
  return {
    version: 1,
    progress: {},
    priorities: {},
    history: {},
    dailyTargets: {},
    settings: {
      startDate: toDateKey(),
      examDate: toDateKey(addDays(new Date(), 30)),
      dailyNew: 20,
      autoDailyNew: true,
      defaultDailyTarget: 40,
    },
    migrations: {},
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function normalizeProgress(progress) {
  if (!isRecord(progress)) return {};
  return Object.fromEntries(Object.entries(progress).flatMap(([id, item]) => {
    if (!isRecord(item)) return [];
    const step = Number(item.step);
    const interval = Number(item.interval);
    return [[id, {
      ...item,
      step: Number.isFinite(step) ? Math.max(-1, Math.trunc(step)) : -1,
      interval: Number.isFinite(interval) ? Math.max(0, interval) : 0,
      attempts: nonNegativeInteger(item.attempts),
      lapses: nonNegativeInteger(item.lapses),
      mastered: Boolean(item.mastered),
    }]];
  }));
}

function normalizeHistory(history) {
  if (!isRecord(history)) return {};
  return Object.fromEntries(Object.entries(history).flatMap(([date, item]) => {
    if (!isRecord(item)) return [];
    const reviewed = nonNegativeInteger(item.reviewed);
    const reviewedQuestionIds = Array.isArray(item.reviewedQuestionIds)
      ? [...new Set(item.reviewedQuestionIds.map(String).filter((id) => /^\d+$/u.test(id)))]
      : [];
    return [[date, {
      ...item,
      reviewed,
      attempts: nonNegativeInteger(item.attempts, reviewed),
      reviewedQuestionIds,
      again: nonNegativeInteger(item.again),
      hard: nonNegativeInteger(item.hard),
      good: nonNegativeInteger(item.good),
      easy: nonNegativeInteger(item.easy),
    }]];
  }));
}

function normalizePriorities(priorities) {
  if (!isRecord(priorities)) return {};
  return Object.fromEntries(
    Object.entries(priorities).filter(([, priority]) => ['A', 'B', 'C'].includes(priority)),
  );
}

function normalizeDailyTargets(targets) {
  if (!isRecord(targets)) return {};
  return Object.fromEntries(Object.entries(targets).flatMap(([date, value]) => {
    const target = Number(value);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(target)) return [];
    return [[date, Math.min(369, Math.max(1, Math.trunc(target)))]];
  }));
}

export function normalizeStudyState(value) {
  const base = defaultState();
  const source = isRecord(value) ? value : {};
  const settings = isRecord(source.settings) ? source.settings : {};
  const dailyNew = nonNegativeInteger(settings.dailyNew, base.settings.dailyNew);

  return {
    ...base,
    ...source,
    version: 1,
    progress: normalizeProgress(source.progress),
    priorities: normalizePriorities(source.priorities),
    history: normalizeHistory(source.history),
    dailyTargets: normalizeDailyTargets(source.dailyTargets),
    settings: {
      ...base.settings,
      ...settings,
      startDate: typeof settings.startDate === 'string' ? settings.startDate : base.settings.startDate,
      examDate: typeof settings.examDate === 'string' ? settings.examDate : base.settings.examDate,
      dailyNew: Math.max(1, dailyNew),
      autoDailyNew: typeof settings.autoDailyNew === 'boolean' ? settings.autoDailyNew : base.settings.autoDailyNew,
      defaultDailyTarget: Math.min(369, Math.max(1, nonNegativeInteger(
        settings.defaultDailyTarget,
        base.settings.defaultDailyTarget,
      ))),
    },
    migrations: isRecord(source.migrations) ? source.migrations : {},
  };
}

const REMOVED_LEGACY_QUESTION_IDS = new Set([42, 43, 227]);
const CURRENT_QUESTION_COUNT = 369;

function legacyQuestionIdToCurrent(id) {
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId < 1 || questionId > 372) return null;
  if (REMOVED_LEGACY_QUESTION_IDS.has(questionId)) return null;
  if (questionId <= 41) return String(questionId);
  if (questionId <= 226) return String(questionId - 2);
  return String(questionId - 3);
}

function remapLegacyQuestionEntries(collection) {
  return Object.fromEntries(Object.entries(collection ?? {}).flatMap(([id, value]) => {
    const currentId = legacyQuestionIdToCurrent(id);
    return currentId ? [[currentId, value]] : [];
  }));
}

function keepCurrentQuestionEntries(collection) {
  return Object.fromEntries(Object.entries(collection ?? {}).filter(([id]) => {
    const questionId = Number(id);
    return Number.isInteger(questionId) && questionId >= 1 && questionId <= CURRENT_QUESTION_COUNT;
  }));
}

// Renumber an old 1-372 save exactly once. New saves keep valid 1-369 keys,
// including 42, 43 and 227, which now refer to different retained questions.
export function migrateQuestionNumbers(state) {
  const alreadyRenumbered = Boolean(state.migrations?.questionRenumberV3);
  const progress = alreadyRenumbered
    ? keepCurrentQuestionEntries(state.progress)
    : remapLegacyQuestionEntries(state.progress);
  const priorities = alreadyRenumbered
    ? keepCurrentQuestionEntries(state.priorities)
    : remapLegacyQuestionEntries(state.priorities);
  return {
    ...state,
    progress,
    priorities,
    migrations: {
      ...(state.migrations ?? {}),
      questionDedupV1: true,
      questionBankCleanupV2: true,
      questionRenumberV3: true,
    },
  };
}

export function useStudyState(username) {
  const storageKey = username ? userStorageKey(username) : STORAGE_KEY;
  const [state, setState] = useState(() => {
    try {
      const saved = username
        ? readFirstJson(userStorageKeys(username)).value
        : readJson(storageKey);
      return migrateQuestionNumbers(normalizeStudyState(saved));
    } catch {
      return defaultState();
    }
  });

  useEffect(() => {
    if (username) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey, username]);

  const patchState = useCallback((updater) => {
    setState((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return migrateQuestionNumbers(normalizeStudyState(next));
    });
  }, []);

  return [state, patchState];
}

export function exportStudyState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `829-memory-backup-${toDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseStudyState(file) {
  return file.text().then((text) => {
    const value = JSON.parse(text);
    if (!value || value.version !== 1 || !value.progress || !value.settings) {
      throw new Error('备份文件格式不正确');
    }
    return migrateQuestionNumbers(normalizeStudyState(value));
  });
}
