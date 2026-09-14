import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { exportStudyState, parseStudyState } from '../storage';

export function SettingsPage({ state, onChange }) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState('');

  const patchSettings = (patch) => onChange((current) => ({
    ...current,
    settings: { ...current.settings, ...patch },
  }));

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = await parseStudyState(file);
      onChange(next);
      setMessage('学习进度已恢复');
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="page settings-page">
      <header className="page-header"><div><p className="date-label">个人计划</p><h1>计划设置</h1></div></header>

      <section className="settings-section">
        <div><h2>考试日期</h2></div>
        <input type="date" value={state.settings.examDate} onChange={(event) => patchSettings({ examDate: event.target.value })} />
      </section>

      <section className="settings-section">
        <div><h2>每日默认题量</h2><p>每天开始学习前仍可单独调整</p></div>
        <div className="setting-control">
          <input
            type="number"
            min="1"
            max="369"
            step="1"
            value={state.settings.defaultDailyTarget ?? 40}
            onChange={(event) => patchSettings({ defaultDailyTarget: Number(event.target.value) })}
            aria-label="每日默认题量"
          />
          <span>题</span>
        </div>
      </section>

      <section className="settings-section backup-section">
        <div><h2>进度备份</h2></div>
        <div className="backup-actions">
          <button className="secondary-button" onClick={() => exportStudyState(state)}><Download size={18} />导出</button>
          <button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={18} />导入</button>
          <input className="visually-hidden" type="file" accept="application/json" ref={inputRef} onChange={importFile} />
        </div>
      </section>
      {message && <p className="settings-message">{message}</p>}
    </section>
  );
}
