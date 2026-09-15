import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { LibraryPage } from './pages/LibraryPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { AuthPage } from './pages/AuthPage';
import { DailyGoalPage } from './pages/DailyGoalPage';
import { buildDailyPlan, DAILY_QUESTION_LIMIT, daysBetween, gradeQuestion, toDateKey } from './scheduler';
import { useProfiles, useStudyState } from './storage';

export default function App() {
  const players = useProfiles();
  if (!players.activeProfile) {
    return <AuthPage profiles={players.profiles} hasLegacySave={players.hasLegacySave} onSelect={players.selectProfile} onCreate={players.createProfile} />;
  }
  return <StudyWorkspace key={players.activeProfile.username} profile={players.activeProfile} onSwitchProfile={players.leaveProfile} />;
}

function StudyWorkspace({ profile, onSwitchProfile }) {
  const { username } = profile;
  const [questions, setQuestions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('today');
  const [focusedQuestion, setFocusedQuestion] = useState(null);
  const [focusedReturnView, setFocusedReturnView] = useState('library');
  const [libraryViewState, setLibraryViewState] = useState({ search: '', filter: 'all' });
  const [mistakesViewState, setMistakesViewState] = useState({ search: '', filter: 'mistakes' });
  const [editingDailyTarget, setEditingDailyTarget] = useState(false);
  const [state, setState] = useStudyState(username);

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
  const todayReviewed = Number(state.history[todayKey]?.reviewed) || 0;
  const storedDailyTarget = state.dailyTargets?.[todayKey];
  const dailyTarget = Number.isInteger(storedDailyTarget) ? storedDailyTarget : null;
  const remainingToday = Math.max(0, (dailyTarget ?? 0) - todayReviewed);
  const dailyPlan = useMemo(
    () => buildDailyPlan(questions, state.progress, remainingToday, new Date(), priorities),
    [priorities, questions, remainingToday, state.progress],
  );

  const setTodayTarget = (target) => {
    setState((current) => ({
      ...current,
      dailyTargets: { ...(current.dailyTargets ?? {}), [todayKey]: target },
      settings: { ...current.settings, defaultDailyTarget: target },
    }));
    setEditingDailyTarget(false);
  };

  const handleGrade = (questionId, grade) => {
    setState((current) => {
      const previous = current.progress[questionId] ?? {};
      const progress = { ...current.progress, [questionId]: gradeQuestion(previous, grade) };
      const today = current.history[todayKey] ?? {
        reviewed: 0,
        attempts: 0,
        reviewedQuestionIds: [],
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
      };
      const reviewedQuestionIds = Array.isArray(today.reviewedQuestionIds)
        ? today.reviewedQuestionIds.map(String)
        : [];
      const questionKey = String(questionId);
      const firstReviewToday = !reviewedQuestionIds.includes(questionKey);
      const reviewed = Number(today.reviewed);
      const attempts = Number(today.attempts);
      const gradeCount = Number(today[grade]);
      return {
        ...current,
        progress,
        history: {
          ...current.history,
          [todayKey]: {
            ...today,
            reviewed: (Number.isFinite(reviewed) ? reviewed : 0) + (firstReviewToday ? 1 : 0),
            attempts: (Number.isFinite(attempts) ? attempts : 0) + 1,
            reviewedQuestionIds: firstReviewToday
              ? [...reviewedQuestionIds, questionKey]
              : reviewedQuestionIds,
            [grade]: (Number.isFinite(gradeCount) ? gradeCount : 0) + 1,
          },
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

  const openQuestion = (question, returnView = 'library') => {
    setFocusedQuestion(question);
    setFocusedReturnView(returnView);
    setView('today');
  };

  const clearFocusedQuestion = () => {
    setFocusedQuestion(null);
    setView(focusedReturnView);
  };

  const mastered = Object.values(state.progress).filter((item) => item.mastered).length;
  const mistakes = Object.values(state.progress).filter((item) => item.lapses > 0).length;
  const shellStats = {
    total: questions.length || 369,
    started,
    mastered,
    mistakes,
    daysLeft: Math.max(0, daysBetween(new Date(), state.settings.examDate)),
    percent: questions.length ? Math.round(started / questions.length * 100) : 0,
  };

  if (loadError) return <div className="app-error">{loadError}</div>;
  if (!questions.length) return <div className="app-loading"><span /><p>正在整理题目…</p></div>;

  return (
    <AppShell activeView={view} onChangeView={setView} stats={shellStats} profile={profile} onSwitchProfile={onSwitchProfile}>
      {view === 'today' && !focusedQuestion && (dailyTarget == null || editingDailyTarget) && (
        <DailyGoalPage
          initialValue={dailyTarget ?? state.settings.defaultDailyTarget ?? DAILY_QUESTION_LIMIT}
          completed={todayReviewed}
          maximum={questions.length}
          editing={editingDailyTarget}
          onConfirm={setTodayTarget}
        />
      )}
      {view === 'today' && (focusedQuestion || (dailyTarget != null && !editingDailyTarget)) && (
        <ReviewPage
          queue={dailyPlan.queue}
          plan={dailyPlan}
          focusedQuestion={focusedQuestion}
          onClearFocus={clearFocusedQuestion}
          onGrade={handleGrade}
          todayReviewed={todayReviewed}
          dailyTarget={dailyTarget ?? DAILY_QUESTION_LIMIT}
          onEditDailyTarget={() => setEditingDailyTarget(true)}
          priorities={priorities}
          onPriority={handlePriority}
        />
      )}
      {view === 'library' && <LibraryPage questions={questions} progress={state.progress} priorities={priorities} onOpenQuestion={(question) => openQuestion(question, 'library')} viewState={libraryViewState} onViewStateChange={(next) => setLibraryViewState((current) => ({ ...current, ...next }))} />}
      {view === 'mistakes' && <LibraryPage questions={questions} progress={state.progress} priorities={priorities} onOpenQuestion={(question) => openQuestion(question, 'mistakes')} mistakesOnly viewState={mistakesViewState} onViewStateChange={(next) => setMistakesViewState((current) => ({ ...current, ...next }))} />}
      {view === 'stats' && <StatsPage questions={questions} progress={state.progress} history={state.history} />}
      {view === 'settings' && <SettingsPage state={state} onChange={setState} />}
    </AppShell>
  );
}
