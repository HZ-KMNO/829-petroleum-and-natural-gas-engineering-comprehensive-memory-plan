import { ChevronDown, ChevronUp, Play, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

export function clampDailyGoal(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

export function DailyGoalPage({ initialValue, completed = 0, maximum = 369, onConfirm, editing = false }) {
  const minimum = Math.max(1, completed);
  const [value, setValue] = useState(() => String(clampDailyGoal(initialValue, minimum, maximum)));

  useEffect(() => {
    setValue(String(clampDailyGoal(initialValue, minimum, maximum)));
  }, [initialValue, maximum, minimum]);

  const adjust = (amount) => {
    setValue((current) => String(clampDailyGoal((Number(current) || minimum) + amount, minimum, maximum)));
  };

  const submit = (event) => {
    event.preventDefault();
    onConfirm(clampDailyGoal(value, minimum, maximum));
  };

  return (
    <section className="page daily-goal-page">
      <div className="daily-goal-panel">
        <span className="daily-goal-icon"><Target size={30} /></span>
        <p className="date-label">今日计划</p>
        <h1>今天想背多少题？</h1>
        {completed > 0 && <p className="daily-goal-completed">今日已完成 {completed} 题</p>}

        <form onSubmit={submit}>
          <label htmlFor="daily-goal-input">今日目标</label>
          <div className="daily-goal-stepper">
            <input
              id="daily-goal-input"
              type="number"
              inputMode="numeric"
              min={minimum}
              max={maximum}
              step="1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => setValue(String(clampDailyGoal(value, minimum, maximum)))}
              autoFocus
            />
            <span>题</span>
            <div className="daily-goal-arrows">
              <button type="button" onClick={() => adjust(1)} aria-label="增加一题" title="增加一题">
                <ChevronUp size={19} />
              </button>
              <button type="button" onClick={() => adjust(-1)} aria-label="减少一题" title="减少一题" disabled={Number(value) <= minimum}>
                <ChevronDown size={19} />
              </button>
            </div>
          </div>
          <button className="daily-goal-submit" type="submit">
            <Play size={19} />{editing ? '更新今日目标' : '开始今日学习'}
          </button>
        </form>
      </div>
    </section>
  );
}
