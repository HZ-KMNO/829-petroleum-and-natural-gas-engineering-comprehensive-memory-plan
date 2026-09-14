import { Archive, ArrowLeft, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { PROFILE_AVATARS, ProfileAvatar } from '../components/ProfileAvatar';

export function AuthPage({ profiles, hasLegacySave = false, onSelect, onCreate }) {
  const [mode, setMode] = useState(profiles.length || hasLegacySave ? 'select' : 'create');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(PROFILE_AVATARS[0].id);
  const [message, setMessage] = useState('');
  const [restoreLegacy, setRestoreLegacy] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    setMessage('');
    try {
      onCreate(username, avatar, { migrateLegacy: restoreLegacy });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const showCreate = () => {
    setUsername('');
    setAvatar(PROFILE_AVATARS[profiles.length % PROFILE_AVATARS.length].id);
    setMessage('');
    setRestoreLegacy(false);
    setMode('create');
  };

  const showRestore = () => {
    setUsername('');
    setAvatar(PROFILE_AVATARS[0].id);
    setMessage('');
    setRestoreLegacy(true);
    setMode('create');
  };

  return (
    <main className="profile-page">
      <section className={`profile-panel ${mode === 'create' ? 'is-create' : ''}`}>
        <div className="profile-brand">
          <img src="/app-icon.png" alt="" />
          <div><strong>829 记忆计划</strong><span>本地学习存档</span></div>
        </div>

        {mode === 'select' ? (
          <>
            <header className="profile-header">
              <h1>选择学习存档</h1>
              <p>欢迎回来</p>
            </header>
            <div className="profile-grid" aria-label="玩家存档">
              {hasLegacySave && (
                <button className="profile-card profile-card-legacy" type="button" onClick={showRestore}>
                  <span className="profile-legacy-icon"><Archive size={29} /></span>
                  <strong>已有存档</strong>
                  <span>继续使用原进度</span>
                </button>
              )}
              {profiles.map((profile) => (
                <button className="profile-card" type="button" onClick={() => onSelect(profile.username)} key={profile.username}>
                  <ProfileAvatar avatar={profile.avatar} size="large" />
                  <strong>{profile.username}</strong>
                  <span>继续学习</span>
                </button>
              ))}
            </div>
            <button className="profile-add-link" type="button" onClick={showCreate}>
              <Plus size={14} />{hasLegacySave && profiles.length === 0 ? '创建新玩家' : '添加新玩家'}
            </button>
          </>
        ) : (
          <>
            {profiles.length > 0 && (
              <button className="profile-back" type="button" onClick={() => setMode('select')}>
                <ArrowLeft size={16} />返回存档列表
              </button>
            )}
            <header className="profile-header">
              <h1>{restoreLegacy ? '恢复已有存档' : profiles.length ? '添加新玩家' : '创建学习存档'}</h1>
              <p>{restoreLegacy ? '原学习进度会保留在新的玩家存档中' : profiles.length ? '建立一份独立的学习记录' : '设置你的玩家名称和头像'}</p>
            </header>
            <form className="profile-form" onSubmit={submit}>
              <label>
                玩家名称
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  placeholder="输入玩家名称"
                  maxLength={16}
                  autoFocus
                  required
                />
              </label>
              <fieldset>
                <legend>选择头像</legend>
                <div className="avatar-options">
                  {PROFILE_AVATARS.map((option) => (
                    <button
                      className={avatar === option.id ? 'active' : ''}
                      type="button"
                      onClick={() => setAvatar(option.id)}
                      aria-label={option.label}
                      aria-pressed={avatar === option.id}
                      title={option.label}
                      key={option.id}
                    >
                      <ProfileAvatar avatar={option.id} />
                    </button>
                  ))}
                </div>
              </fieldset>
              {message && <p className="profile-message" role="alert">{message}</p>}
              <button className="profile-submit" type="submit">
                <UserPlus size={18} />{restoreLegacy ? '恢复并开始' : '创建并开始'}
              </button>
            </form>
          </>
        )}

        <p className="profile-note">每位玩家拥有独立的本地学习记录。</p>
      </section>
    </main>
  );
}
