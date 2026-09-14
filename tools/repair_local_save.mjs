import fs from 'node:fs';
import path from 'node:path';

const DEBUG_ENDPOINT = process.env.MEMORY829_DEBUG_ENDPOINT ?? 'http://127.0.0.1:9333/json/list';
const APPLY = process.argv.includes('--apply');
const REMOVED_LEGACY_IDS = new Set([42, 43, 227]);
const CURRENT_QUESTION_COUNT = 369;
const STATE_KEY = '829-memory-state-v1';
const PROFILE_KEY = '829-memory-profiles-v1';
const LEGACY_CLAIM_KEY = '829-memory-legacy-save-claimed-v1';

async function connect() {
  const targets = await fetch(DEBUG_ENDPOINT).then((response) => response.json());
  const target = targets.find((item) => item.type === 'page' && item.url.startsWith('study829://app/'));
  if (!target?.webSocketDebuggerUrl) throw new Error('没有找到正在运行的 829 桌面应用页面');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let requestId = 0;
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', listener);
      if (message.error || message.result?.exceptionDetails) {
        reject(new Error(message.error?.message ?? message.result.exceptionDetails.text));
        return;
      }
      resolve(message.result.result.value);
    };
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true },
    }));
  });

  return { socket, evaluate };
}

function mapLegacyId(id) {
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId < 1 || questionId > 372) return null;
  if (REMOVED_LEGACY_IDS.has(questionId)) return null;
  if (questionId <= 41) return String(questionId);
  if (questionId <= 226) return String(questionId - 2);
  return String(questionId - 3);
}

function remapLegacyEntries(collection) {
  const mapped = {};
  const removed = [];
  let renumbered = 0;
  for (const [id, value] of Object.entries(collection ?? {})) {
    const currentId = mapLegacyId(id);
    if (!currentId) {
      removed.push(id);
      continue;
    }
    mapped[currentId] = value;
    if (currentId !== id) renumbered += 1;
  }
  return { mapped, removed, renumbered, invalid: [] };
}

function validateCurrentEntries(collection) {
  const mapped = {};
  const invalid = [];
  for (const [id, value] of Object.entries(collection ?? {})) {
    const questionId = Number(id);
    if (!Number.isInteger(questionId) || questionId < 1 || questionId > CURRENT_QUESTION_COUNT) {
      invalid.push(id);
      continue;
    }
    mapped[id] = value;
  }
  return { mapped, removed: [], renumbered: 0, invalid };
}

function readStateEntries(storage) {
  return Object.entries(storage).flatMap(([key, value]) => {
    if (key !== STATE_KEY && !key.startsWith(`${STATE_KEY}:user:`)) return [];
    try {
      const state = JSON.parse(value);
      const alreadyRenumbered = Boolean(state.migrations?.questionRenumberV3);
      const migrate = alreadyRenumbered ? validateCurrentEntries : remapLegacyEntries;
      const progress = migrate(state.progress);
      const priorities = migrate(state.priorities);
      return [{
        key,
        alreadyRenumbered,
        state: {
          ...state,
          progress: progress.mapped,
          priorities: priorities.mapped,
          migrations: {
            ...(state.migrations ?? {}),
            questionDedupV1: true,
            questionBankCleanupV2: true,
            questionRenumberV3: true,
          },
        },
        beforeProgressCount: Object.keys(state.progress ?? {}).length,
        removedProgress: progress.removed,
        removedPriorities: priorities.removed,
        renumberedProgress: progress.renumbered,
        renumberedPriorities: priorities.renumbered,
        invalidProgress: progress.invalid,
        invalidPriorities: priorities.invalid,
      }];
    } catch {
      throw new Error(`存档 ${key} 不是有效 JSON，已停止操作`);
    }
  });
}

function displayName(key) {
  if (key === STATE_KEY) return '旧版已有存档';
  return decodeURIComponent(key.slice(`${STATE_KEY}:user:`.length));
}

const { socket, evaluate } = await connect();
try {
  const storage = JSON.parse(await evaluate(`JSON.stringify(Object.fromEntries(Array.from({ length: localStorage.length }, (_, index) => { const key = localStorage.key(index); return [key, localStorage.getItem(key)]; })))`));
  const profileStore = JSON.parse(storage[PROFILE_KEY] ?? '{"version":1,"profiles":[]}');
  const profiles = profileStore.profiles ?? [];
  const entries = readStateEntries(storage);
  const affected = entries.filter((entry) => (
    !entry.alreadyRenumbered || entry.invalidProgress.length || entry.invalidPriorities.length
  ));
  const registeredNames = new Set(profiles.map((profile) => profile.username.toLocaleLowerCase()));
  const orphanNames = entries
    .filter((entry) => entry.key.startsWith(`${STATE_KEY}:user:`))
    .map((entry) => displayName(entry.key))
    .filter((name) => !registeredNames.has(name.toLocaleLowerCase()));
  const nextProfiles = [
    ...profiles,
    ...orphanNames.map((username) => ({
      username,
      avatar: 'compass',
      createdAt: new Date().toISOString(),
    })),
  ];
  const legacyState = JSON.parse(storage[STATE_KEY] ?? 'null');
  const emptyLegacyState = Boolean(legacyState)
    && !Object.keys(legacyState.progress ?? {}).length
    && !Object.keys(legacyState.priorities ?? {}).length
    && !Object.keys(legacyState.history ?? {}).length;

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    profiles: profiles.map((profile) => profile.username),
    orphanProfiles: orphanNames,
    saves: entries.map((entry) => ({
      name: displayName(entry.key),
      alreadyRenumbered: entry.alreadyRenumbered,
      beforeProgressCount: entry.beforeProgressCount,
      afterProgressCount: Object.keys(entry.state.progress).length,
      removedProgress: entry.removedProgress,
      removedPriorities: entry.removedPriorities,
      renumberedProgress: entry.renumberedProgress,
      renumberedPriorities: entry.renumberedPriorities,
      invalidProgress: entry.invalidProgress,
      invalidPriorities: entry.invalidPriorities,
    })),
    affectedSaves: affected.length,
  }, null, 2));

  if (APPLY && (affected.length || orphanNames.length)) {
    const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
    const backupDirectory = path.resolve('save-backups');
    const backupPath = path.join(backupDirectory, `829-memory-before-question-renumber-${timestamp}.json`);
    fs.mkdirSync(backupDirectory, { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), storage }, null, 2));

    const updates = Object.fromEntries(affected.map((entry) => [entry.key, JSON.stringify(entry.state)]));
    if (orphanNames.length) {
      updates[PROFILE_KEY] = JSON.stringify({ ...profileStore, version: 1, profiles: nextProfiles });
      if (emptyLegacyState) updates[LEGACY_CLAIM_KEY] = '1';
    }
    const expression = `(() => { const updates = ${JSON.stringify(updates)}; for (const [key, value] of Object.entries(updates)) localStorage.setItem(key, value); return Object.keys(updates); })()`;
    const updatedKeys = await evaluate(expression);
    console.log(JSON.stringify({ backupPath, updatedStorageKeys: updatedKeys }, null, 2));
  }
} finally {
  socket.close();
}
