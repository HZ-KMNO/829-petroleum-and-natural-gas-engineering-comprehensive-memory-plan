export const DAY = 24 * 60 * 60 * 1000;
export const LEARNING_STEPS = [1, 3, 7, 14, 30];

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toDateKey(value = new Date()) {
  const date = startOfDay(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(value, days) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function daysBetween(from, to) {
  return Math.ceil((startOfDay(to) - startOfDay(from)) / DAY);
}

export function gradeQuestion(previous = {}, grade, now = new Date()) {
  const oldStep = previous.step ?? -1;
  const oldInterval = previous.interval ?? 0;
  let step = oldStep;
  let interval = oldInterval;

  if (grade === 'again') {
    step = 0;
    interval = 1;
  } else if (grade === 'hard') {
    step = Math.max(0, oldStep);
    interval = oldInterval > 0 ? Math.max(1, Math.round(oldInterval * 1.25)) : 1;
  } else if (grade === 'good') {
    step = Math.min(oldStep + 1, LEARNING_STEPS.length - 1);
    interval = LEARNING_STEPS[step];
  } else {
    step = Math.min(oldStep + 2, LEARNING_STEPS.length - 1);
    interval = Math.max(3, LEARNING_STEPS[step], Math.round(oldInterval * 1.8));
  }

  const attempts = (previous.attempts ?? 0) + 1;
  const lapses = (previous.lapses ?? 0) + (grade === 'again' ? 1 : 0);
  const mastered = grade === 'easy' || (step >= 3 && grade === 'good');

  return {
    ...previous,
    step,
    interval,
    due: toDateKey(addDays(now, interval)),
    lastReviewed: toDateKey(now),
    lastGrade: grade,
    attempts,
    lapses,
    mastered,
  };
}

export function buildTodayQueue(questions, progress, dailyNew, today = new Date(), priorities = {}) {
  const key = toDateKey(today);
  const rank = { A: 0, B: 1, C: 2 };
  const byPriority = (left, right) => (rank[priorities[left.id] ?? 'B'] - rank[priorities[right.id] ?? 'B']) || left.id - right.id;
  const due = questions.filter((question) => {
    const item = progress[question.id];
    return item?.due && item.due <= key;
  }).sort(byPriority);
  const unseen = questions.filter((question) => !progress[question.id]).sort(byPriority);
  return [...due, ...unseen.slice(0, dailyNew)];
}

export function dailyTarget(total, unseen, examDate, today = new Date()) {
  const remaining = Math.max(1, daysBetween(today, examDate));
  const learningDays = Math.max(1, Math.min(19, remaining - 10));
  return Math.max(1, Math.ceil(unseen / learningDays));
}
