import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  Menu,
  Settings,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';

const items = [
  { id: 'today', label: '今日复习', icon: CalendarClock },
  { id: 'library', label: '全部题库', icon: BookOpen },
  { id: 'mistakes', label: '错题本', icon: TriangleAlert },
  { id: 'stats', label: '学习统计', icon: BarChart3 },
  { id: 'settings', label: '计划设置', icon: Settings },
];

export function AppShell({ activeView, onChangeView, children, stats }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (id) => {
    onChangeView(id);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <div className="brand brand-mobile"><Brain size={23} /><strong>829 记忆计划</strong></div>
        <button className="icon-button" onClick={() => setMobileOpen((value) => !value)} aria-label="打开导航">
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="brand"><Brain size={25} /><strong>829 记忆计划</strong></div>
        <nav className="primary-nav" aria-label="主导航">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              className={activeView === id ? 'active' : ''}
              onClick={() => navigate(id)}
              key={id}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === 'mistakes' && stats.mistakes > 0 && <span className="nav-count">{stats.mistakes}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-progress">
          <div className="sidebar-progress-row">
            <span>30 天计划</span>
            <strong>{stats.daysLeft} 天</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${stats.percent}%` }} /></div>
          <p>{stats.started} / {stats.total} 题已开始</p>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav" aria-label="移动端导航">
        {items.slice(0, 4).map(({ id, label, icon: Icon }) => (
          <button className={activeView === id ? 'active' : ''} onClick={() => navigate(id)} key={id}>
            <Icon size={19} />
            <span>{label.replace('全部', '')}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
