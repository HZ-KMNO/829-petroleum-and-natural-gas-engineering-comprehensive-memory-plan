import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Eye, Gauge, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { QuestionContent } from '../components/QuestionContent';
import { questionTypeLabel } from '../questionTypes';

const grades = [
  { id: 'again', label: '不会', icon: RotateCcw },
  { id: 'hard', label: '不熟', icon: Gauge },
  { id: 'good', label: '熟练', icon: Check },
];

export function ReviewPage({ queue, plan, focusedQuestion, onClearFocus, onGrade, onPriority, priorities, todayReviewed, dailyTarget, onEditDailyTarget }) {
  const [session, setSession] = useState(() => ({ items: queue, index: 0 }));
  const sessionPlan = useRef(plan).current;
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState('cloze');

  const { items: sessionQueue, index } = session;
  const active = focusedQuestion ?? sessionQueue[index];
  const isFocused = Boolean(focusedQuestion);

  useEffect(() => {
    setRevealed(false);
  }, [active?.id]);

  const handleGrade = (grade) => {
    if (!active) return;
    onGrade(active.id, grade);
    setRevealed(false);
    if (isFocused) {
      onClearFocus();
      return;
    }
    setSession((current) => advanceReviewSession(current, active.id, grade));
  };

  // Space reveals the answer, then 1/2/3 grade it. The shortcut is printed on the
  // button itself, so the whole flow is reachable without leaving the keyboard.
  useEffect(() => {
    const handler = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (!active || event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (revealed && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
        const grade = grades[Number(event.code.slice(-1)) - 1];
        if (grade) handleGrade(grade.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!active) {
    return (
      <section className="page review-page">
        <div className="completion-panel">
          <div className="completion-icon"><Check size={34} /></div>
          <h2>今日任务已完成</h2>
          <p>已完成 {todayReviewed} 次复习，明天继续按计划推进。</p>
          <div className="completion-actions">
            <button className="primary-button" onClick={() => window.location.reload()}>检查最新任务</button>
            <button className="secondary-button" onClick={onEditDailyTarget}><SlidersHorizontal size={17} />调整今日题量</button>
          </div>
        </div>
      </section>
    );
  }

  const position = Math.min(index + 1, sessionQueue.length);
  const total = Math.max(1, sessionQueue.length);

  return (
    <section className="page review-page">
      <header className="review-header">
        {isFocused && (
          <button className="back-button" onClick={onClearFocus}><ChevronLeft size={18} />返回题库</button>
        )}
        <div className="review-meta">
          <h1 className="question-number">第 {active.id} 题</h1>
          <span className="chapter-label">
            第 {active.chapter?.number ?? 0} 章 · {active.chapter?.title ?? '综合题'} · {questionTypeLabel(active.category)}
          </span>
          <select
            aria-label="题目级别"
            value={priorities[active.id] ?? 'B'}
            onChange={(event) => onPriority(active.id, event.target.value)}
          >
            <option value="A">A 重点</option>
            <option value="B">B 常规</option>
            <option value="C">C 了解</option>
          </select>
        </div>
        <div className="review-meta-end">
          {!isFocused && (
            <span className="queue-position" title="本次队列进度">{position} / {total}</span>
          )}
          <div className="segmented-control" aria-label="练习模式">
            <button className={mode === 'cloze' ? 'active' : ''} onClick={() => setMode('cloze')}>挖空</button>
            <button className={mode === 'recall' ? 'active' : ''} onClick={() => setMode('recall')}>整题</button>
          </div>
        </div>
      </header>

      {!isFocused && (
        <div className="session-progress" aria-label={`本次进度 ${position}/${total}`}>
          <span style={{ width: `${Math.round(((position - 1) / total) * 100)}%` }} />
        </div>
      )}

      <article className="review-surface">
        <QuestionContent
          question={active}
          revealed={revealed}
          compact={mode === 'recall' && !revealed}
          revealOnClick={mode === 'cloze' && !revealed}
        />
      </article>

      {!revealed ? (
        <button className="reveal-button" onClick={() => setRevealed(true)}>
          <Eye size={20} />核对答案
          <kbd>空格</kbd>
        </button>
      ) : (
        <div className="grade-bar">
          {grades.map(({ id, label, icon: Icon }, gradeIndex) => (
            <button className={`grade-button grade-${id}`} onClick={() => handleGrade(id)} key={id}>
              <Icon size={19} />
              <span>{label}</span>
              <kbd>{gradeIndex + 1}</kbd>
            </button>
          ))}
        </div>
      )}

      {!isFocused && sessionPlan && (
        <p className="review-plan-summary">
          本轮 {sessionPlan.dueCount} 题到期复习 · {sessionPlan.newCount} 题新学
          {sessionPlan.deferredDueCount > 0 && <em> · {sessionPlan.deferredDueCount} 题顺延</em>}
        </p>
      )}
    </section>
  );
}

export function advanceReviewSession(session, answeredId, grade = 'good') {
  const answeredIndex = session.items.findIndex((question) => question.id === answeredId);
  if (answeredIndex < 0) return session;
  const items = [...session.items];
  const [answered] = items.splice(answeredIndex, 1);
  if (grade === 'again') {
    const relearnIndex = Math.min(answeredIndex + 3, items.length);
    items.splice(relearnIndex, 0, answered);
  }
  return {
    items,
    index: Math.min(session.index, Math.max(0, items.length - 1)),
  };
}
