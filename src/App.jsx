import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { LibraryPage } from './pages/LibraryPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { buildTodayQueue, dailyTarget, daysBetween, gradeQuestion, toDateKey } from './scheduler';
import { useStudyState } from './storage';

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('today');
  const [focusedQuestion, setFocusedQuestion] = useState(null);
  const [state, setState] = useStudyState();

  useEffect(() => {
    fetch('/data/questions.json')
      .then((response) => {
        if (!response.ok) throw new Error('题库载入失败');
        return response.json();
      })
      .then((data) => setQuestions(data.questions))
      .catch((error) => setLoadError(error.message));
  }, []);

  const todayKey = toDateKey();
  const priorities = state.priorities ?? {};
  const started = Object.keys(state.progress).length;
  const unseen = Math.max(0, questions.length - started);
  const calculatedDaily = questions.length
    ? dailyTarget(questions.length, unseen, state.settings.examDate)
    : state.settings.dailyNew;
  const dailyNew = state.settings.autoDailyNew ? calculatedDaily : state.settings.dailyNew;
  const queue = useMemo(
    () => buildTodayQueue(questions, state.progress, dailyNew, new Date(), priorities),
    [dailyNew, priorities, questions, state.progress],
  );

  useEffect(() => {
    if (state.settings.autoDailyNew && state.settings.dailyNew !== calculatedDaily && questions.length) {
      setState((current) => ({ ...current, settings: { ...current.settings, dailyNew: calculatedDaily } }));
    }
  }, [calculatedDaily, questions.length, setState, state.settings.autoDailyNew, state.settings.dailyNew]);

  const handleGrade = (questionId, grade) => {
    setState((current) => {
      const previous = current.progress[questionId] ?? {};
      const progress = { ...current.progress, [questionId]: gradeQuestion(previous, grade) };
      const today = current.history[todayKey] ?? { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
      return {
        ...current,
        progress,
        history: {
          ...current.history,
          [todayKey]: { ...today, reviewed: today.reviewed + 1, [grade]: today[grade] + 1 },
        },
      };
    });
  };

  const handlePriority = (questionId, priority) => {
    setState((current) => ({
      ...current,
      priorities: { ...current.priorities, [questionId]: priority },
    }));
  };

  const openQuestion = (question) => {
    setFocusedQuestion(question);
    setView('today');
  };

  const mastered = Object.values(state.progress).filter((item) => item.mastered).length;
  const mistakes = Object.values(state.progress).filter((item) => item.lapses > 0).length;
  const shellStats = {
    total: questions.length || 372,
    started,
    mastered,
    mistakes,
    daysLeft: Math.max(0, daysBetween(new Date(), state.settings.examDate)),
    percent: questions.length ? Math.round(started / questions.length * 100) : 0,
  };

  if (loadError) return <div className="app-error">{loadError}</div>;
  if (!questions.length) return <div className="app-loading"><span /><p>正在整理 372 道题目…</p></div>;

  return (
    <AppShell activeView={view} onChangeView={setView} stats={shellStats}>
      {view === 'today' && (
        <ReviewPage
          queue={queue}
          focusedQuestion={focusedQuestion}
          onClearFocus={() => setFocusedQuestion(null)}
          onGrade={handleGrade}
          todayReviewed={state.history[todayKey]?.reviewed ?? 0}
          dailyNew={dailyNew}
          priorities={priorities}
          onPriority={handlePriority}
        />
      )}
      {view === 'library' && <LibraryPage questions={questions} progress={state.progress} priorities={priorities} onOpenQuestion={openQuestion} />}
      {view === 'mistakes' && <LibraryPage questions={questions} progress={state.progress} priorities={priorities} onOpenQuestion={openQuestion} mistakesOnly />}
      {view === 'stats' && <StatsPage questions={questions} progress={state.progress} history={state.history} />}
      {view === 'settings' && <SettingsPage state={state} onChange={setState} />}
    </AppShell>
  );
}
