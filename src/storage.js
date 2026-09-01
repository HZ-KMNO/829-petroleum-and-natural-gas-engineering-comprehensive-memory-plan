import { useCallback, useEffect, useState } from 'react';
import { addDays, toDateKey } from './scheduler';

const STORAGE_KEY = new URLSearchParams(window.location.search).has('qa')
  ? '829-memory-state-qa-v1'
  : '829-memory-state-v1';

function defaultState() {
  return {
    version: 1,
    progress: {},
    priorities: {},
    history: {},
    settings: {
      startDate: toDateKey(),
      examDate: toDateKey(addDays(new Date(), 30)),
      dailyNew: 20,
      autoDailyNew: true,
    },
  };
}

export function useStudyState() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultState(), ...JSON.parse(saved) } : defaultState();
    } catch {
      return defaultState();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const patchState = useCallback((updater) => {
    setState((current) => (typeof updater === 'function' ? updater(current) : { ...current, ...updater }));
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
    const base = defaultState();
    return { ...base, ...value, settings: { ...base.settings, ...value.settings } };
  });
}
