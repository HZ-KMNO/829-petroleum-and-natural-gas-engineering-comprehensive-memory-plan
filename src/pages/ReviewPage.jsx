import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, Gauge, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { QuestionContent } from '../components/QuestionContent';

const grades = [
  { id: 'again', label: '忘记', icon: RotateCcw },
  { id: 'hard', label: '困难', icon: Gauge },
  { id: 'good', label: '记得', icon: Check },
  { id: 'easy', label: '熟练', icon: Sparkles },
];

export function ReviewPage({ queue, focusedQuestion, onClearFocus, onGrade, onPriority, priorities, todayReviewed, dailyTarget, onEditDailyTarget }) {
  const [session, setSession] = useState(() => ({ items: queue, index: 0 }));
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [mode, setMode] = useState('cloze');
  const answerRef = useRef(null);

  const { items: sessionQueue, index } = session;
  const active = focusedQuestion ?? sessionQueue[index];
  const isFocused = Boolean(focusedQuestion);

  useEffect(() => {
    setRevealed(false);
    setAnswer('');
  }, [active?.id]);

  useEffect(() => {
    const handler = (event) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space' && active && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      if (!isFocused && event.code === 'ArrowLeft') { event.preventDefault(); goPrevious(); }
      if (!isFocused && event.code === 'ArrowRight') { event.preventDefault(); goNext(); }
      if (revealed && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
        const grade = grades[Number(event.code.slice(-1)) - 1];
        if (grade) handleGrade(grade.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const goPrevious = () => {
    if (isFocused) return;
    setSession((current) => ({ ...current, index: Math.max(0, current.index - 1) }));
  };

  const goNext = () => {
    if (isFocused) return;
    setSession((current) => ({ ...current, index: Math.min(current.items.length - 1, current.index + 1) }));
  };

  const handleGrade = (grade) => {
    if (!active) return;
    onGrade(active.id, grade);
    if (isFocused) {
      onClearFocus();
      return;
    }
    setSession((current) => advanceReviewSession(current, active.id));
  };

  if (!active) {
    return (
      <section className="page review-page">
        <header className="page-header">
          <div><p className="date-label">今天</p><h1>今日任务已完成</h1></div>
        </header>
        <div className="completion-panel">
          <div className="completion-icon"><Check size={34} /></div>
          <h2>今天的记忆已经加固</h2>
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
      <header className="page-header review-header">
        <div>
          {isFocused ? (
            <button className="back-button" onClick={onClearFocus}><ChevronLeft size={18} />返回题库</button>
          ) : (
            <><p className="date-label">今日复习</p><h1>{todayReviewed === 0 ? '从第一题开始' : '继续保持节奏'}</h1></>
          )}
        </div>
        <div className="header-metrics">
          <span><strong>{todayReviewed}</strong><small>今日完成</small></span>
          <button className="daily-target-metric" type="button" onClick={onEditDailyTarget} title="调整今日题量">
            <strong>{dailyTarget}</strong><small>今日目标</small>
          </button>
        </div>
      </header>

      {!isFocused && (
        <div className="session-progress" aria-label={`本次进度 ${position}/${total}`}>
          <span style={{ width: `${Math.round(((position - 1) / total) * 100)}%` }} />
        </div>
      )}

      <div className="review-toolbar">
        <div className="question-meta">
          <span className="question-number">第 {active.id} 题</span>
          <span className="chapter-label">第 {active.chapter?.number ?? 0} 章 · {active.chapter?.title ?? '综合题'}</span>
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
        <div className="segmented-control" aria-label="练习模式">
          <button className={mode === 'cloze' ? 'active' : ''} onClick={() => setMode('cloze')}>挖空</button>
          <button className={mode === 'recall' ? 'active' : ''} onClick={() => setMode('recall')}>整题</button>
        </div>
        {!isFocused && <span className="queue-position">{position} / {total}</span>}
      </div>

      <article className="review-surface">
        <QuestionContent
          question={active}
          revealed={revealed}
          compact={mode === 'recall' && !revealed}
          revealOnClick={mode === 'cloze' && !revealed}
        />
      </article>

      <div className="answer-area">
        <label htmlFor="self-answer">我的答案</label>
        <textarea
          id="self-answer"
          ref={answerRef}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="写下关键词或答题骨架…"
          rows={3}
        />
      </div>

      {!isFocused && (
        <div className="question-navigation" aria-label="题目切换">
          <button type="button" onClick={goPrevious} disabled={index === 0} title="上一题"><ChevronLeft size={18} />上一题</button>
          <button type="button" onClick={goNext} disabled={index >= sessionQueue.length - 1} title="下一题">下一题<ChevronRight size={18} /></button>
        </div>
      )}

      {!revealed ? (
        <button className="reveal-button" onClick={() => setRevealed(true)}><Eye size={20} />核对答案</button>
      ) : (
        <div className="grade-bar">
          {grades.map(({ id, label, icon: Icon }) => (
            <button className={`grade-button grade-${id}`} onClick={() => handleGrade(id)} key={id}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function advanceReviewSession(session, answeredId) {
  const answeredIndex = session.items.findIndex((question) => question.id === answeredId);
  if (answeredIndex < 0) return session;
  const items = session.items.filter((_, itemIndex) => itemIndex !== answeredIndex);
  return {
    items,
    index: Math.min(session.index, Math.max(0, items.length - 1)),
  };
}
