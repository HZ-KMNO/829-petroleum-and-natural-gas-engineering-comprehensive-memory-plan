export const PROFILE_AVATAR_IDS = [
  'compass',
  'book',
  'flame',
  'mountain',
  'star',
  'rocket',
  'gem',
  'sun',
];

export function validatePlayerName(name) {
  const value = name.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}_ -]{1,16}$/u.test(value)) {
    throw new Error('玩家名称需为 1-16 个中文、字母、数字、空格、下划线或短横线');
  }
  return value;
}

export function normalizeProfileStore(value, legacyAuth = {}, discoveredNames = []) {
  const storedProfiles = Array.isArray(value?.profiles) ? value.profiles : [];
  const accounts = Object.values(legacyAuth?.accounts ?? {});
  const sourceProfiles = storedProfiles.length ? storedProfiles : accounts;
  const profiles = sourceProfiles.filter((profile) => profile?.username).map((profile, index) => ({
    username: profile.username,
    avatar: PROFILE_AVATAR_IDS.includes(profile.avatar)
      ? profile.avatar
      : PROFILE_AVATAR_IDS[index % PROFILE_AVATAR_IDS.length],
    createdAt: profile.createdAt ?? new Date(0).toISOString(),
  }));
  const knownNames = new Set(profiles.map((profile) => profile.username.toLocaleLowerCase()));

  for (const name of discoveredNames) {
    const username = String(name ?? '').trim();
    if (!username || knownNames.has(username.toLocaleLowerCase())) continue;
    profiles.push({
      username,
      avatar: PROFILE_AVATAR_IDS[profiles.length % PROFILE_AVATAR_IDS.length],
      createdAt: new Date(0).toISOString(),
    });
    knownNames.add(username.toLocaleLowerCase());
  }

  return {
    version: 1,
    profiles,
  };
}

export function addProfile(store, name, avatar) {
  const username = validatePlayerName(name);
  if (store.profiles.some((profile) => profile.username.toLocaleLowerCase() === username.toLocaleLowerCase())) {
    throw new Error('这个玩家名称已经存在');
  }
  if (!PROFILE_AVATAR_IDS.includes(avatar)) throw new Error('请选择一个头像');

  const profile = { username, avatar, createdAt: new Date().toISOString() };
  return [{ ...store, profiles: [...store.profiles, profile] }, profile];
}
