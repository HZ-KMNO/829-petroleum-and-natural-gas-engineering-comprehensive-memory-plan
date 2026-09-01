import { addDays, toDateKey } from '../scheduler';

export function StatsPage({ questions, progress, history }) {
  const items = Object.values(progress);
  const mastered = items.filter((item) => item.mastered).length;
  const learning = items.length - mastered;
  const unseen = questions.length - items.length;
  const totalAttempts = items.reduce((sum, item) => sum + (item.attempts ?? 0), 0);
  const lapses = items.reduce((sum, item) => sum + (item.lapses ?? 0), 0);
  const accuracy = totalAttempts ? Math.round(((totalAttempts - lapses) / totalAttempts) * 100) : 0;
  const days = Array.from({ length: 30 }, (_, index) => addDays(new Date(), index - 29));
  const maxReviewed = Math.max(1, ...days.map((date) => history[toDateKey(date)]?.reviewed ?? 0));

  const distribution = [
    { label: '已掌握', value: mastered, color: '#138a72' },
    { label: '学习中', value: learning, color: '#d3912f' },
    { label: '未学习', value: unseen, color: '#d8ddda' },
  ];

  return (
    <section className="page stats-page">
      <header className="page-header"><div><p className="date-label">学习反馈</p><h1>进度统计</h1></div></header>

      <div className="stat-strip">
        <div><span>已开始</span><strong>{items.length}</strong><small>/ {questions.length} 题</small></div>
        <div><span>已掌握</span><strong>{mastered}</strong><small>{questions.length ? Math.round(mastered / questions.length * 100) : 0}%</small></div>
        <div><span>累计复习</span><strong>{totalAttempts}</strong><small>次主动回忆</small></div>
        <div><span>回忆正确率</span><strong>{accuracy}%</strong><small>按自评计算</small></div>
      </div>

      <section className="analytics-section">
        <div className="section-heading"><h2>掌握分布</h2><span>{mastered + learning} 题已进入计划</span></div>
        <div className="distribution-bar">
          {distribution.filter((item) => item.value > 0).map((item) => (
            <span key={item.label} style={{ width: `${item.value / questions.length * 100}%`, background: item.color }} />
          ))}
        </div>
        <div className="distribution-legend">
          {distribution.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}<strong>{item.value}</strong></span>)}
        </div>
      </section>

      <section className="analytics-section activity-section">
        <div className="section-heading"><h2>最近 30 天</h2></div>
        <div className="activity-grid">
          {days.map((date) => {
            const key = toDateKey(date);
            const reviewed = history[key]?.reviewed ?? 0;
            const level = reviewed === 0 ? 0 : Math.max(1, Math.ceil(reviewed / maxReviewed * 4));
            return <span className={`activity-cell level-${level}`} title={`${key}: ${reviewed} 次`} key={key} />;
          })}
        </div>
        <div className="activity-axis"><span>{toDateKey(days[0]).slice(5)}</span><span>今天</span></div>
      </section>
    </section>
  );
}
