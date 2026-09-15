import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';

export const DAY = 24 * 60 * 60 * 1000;
export const DAILY_QUESTION_LIMIT = 40;
const IMAGE_WORKLOAD = 80;
const FOCUS_WINDOW = 6;

const memoryScheduler = fsrs({
  request_retention: 0.92,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: false,
  learning_steps: [],
  relearning_steps: [],
});

const FSRS_RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Good,
};

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

function dateFromStorage(value, fallback) {
  if (typeof value === 'string') {
    const dateKey = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (dateKey) return new Date(Number(dateKey[1]), Number(dateKey[2]) - 1, Number(dateKey[3]));
  }
  const parsed = value == null ? new Date(Number.NaN) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(fallback) : startOfDay(parsed);
}

function boundedNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function restoreFsrsCard(previous, now) {
  const stored = previous.fsrs;
  if (stored && Number(stored.stability) >= 0 && Number(stored.difficulty) > 0) {
    return {
      ...stored,
      due: dateFromStorage(stored.due ?? previous.due, now),
      stability: Number(stored.stability),
      difficulty: Number(stored.difficulty),
      elapsed_days: Number(stored.elapsed_days ?? 0),
      scheduled_days: Number(stored.scheduled_days ?? previous.interval ?? 0),
      learning_steps: Number(stored.learning_steps ?? 0),
      reps: Number(stored.reps ?? previous.attempts ?? 0),
      lapses: Number(stored.lapses ?? previous.lapses ?? 0),
      state: stored.state ?? State.Review,
      last_review: dateFromStorage(stored.last_review ?? previous.lastReviewed, now),
    };
  }

  const attempts = Math.max(0, Number(previous.attempts) || 0);
  if (!attempts) return createEmptyCard(startOfDay(now));

  const interval = Math.max(1, Number(previous.interval) || 1);
  const lapses = Math.max(0, Number(previous.lapses) || 0);
  const lastReview = dateFromStorage(previous.lastReviewed, addDays(now, -interval));
  const lapseRatio = Math.min(1, lapses / attempts);

  return {
    due: dateFromStorage(previous.due, addDays(lastReview, interval)),
    stability: Math.max(0.1, interval),
    difficulty: boundedNumber(5 + lapseRatio * 3, 1, 10, 5),
    elapsed_days: Math.max(0, daysBetween(lastReview, now)),
    scheduled_days: interval,
    learning_steps: 0,
    reps: attempts,
    lapses,
    state: State.Review,
    last_review: lastReview,
  };
}

function serializeFsrsCard(card) {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString() ?? null,
  };
}

export function gradeQuestion(previous = {}, grade, now = new Date()) {
  const normalizedGrade = grade === 'easy' ? 'good' : grade;
  const rating = FSRS_RATINGS[normalizedGrade];
  if (!rating) throw new Error(`Unsupported review grade: ${grade}`);

  const card = restoreFsrsCard(previous, now);
  const nextCard = memoryScheduler.next(card, startOfDay(now), rating).card;
  const interval = Math.max(1, Math.round(nextCard.scheduled_days));
  const attempts = (Number(previous.attempts) || 0) + 1;
  const lapses = (Number(previous.lapses) || 0) + (normalizedGrade === 'again' ? 1 : 0);

  return {
    ...previous,
    step: normalizedGrade === 'again' ? 0 : Math.max(0, Number(previous.step) || 0) + 1,
    interval,
    due: toDateKey(nextCard.due),
    lastReviewed: toDateKey(now),
    lastGrade: normalizedGrade,
    attempts,
    lapses,
    mastered: normalizedGrade === 'good' && nextCard.stability >= 14,
    fsrs: serializeFsrsCard(nextCard),
  };
}

export function questionWorkload(question) {
  return (question.blocks ?? []).reduce((total, block) => {
    const textLength = Array.from(block.text ?? '').filter((character) => !/\s/u.test(character)).length;
    return total + textLength + (block.type === 'image' ? IMAGE_WORKLOAD : 0);
  }, 0);
}

function priorityRank(question, priorities) {
  return ({ A: 0, B: 1, C: 2 })[priorities[question.id] ?? 'B'];
}

function reviewUrgency(question, progress, today, priorities) {
  const item = progress[question.id] ?? {};
  const interval = Math.max(1, Number(item.interval ?? item.fsrs?.scheduled_days) || 1);
  const dueDate = dateFromStorage(item.due, today);
  const overdueDays = Math.max(0, daysBetween(dueDate, today));
  let retrievability = 1 / (1 + overdueDays / interval);

  try {
    retrievability = memoryScheduler.get_retrievability(restoreFsrsCard(item, today), startOfDay(today), false);
  } catch {
    // Legacy records without a complete memory state still use the overdue estimate.
  }

  const priorityBoost = { A: 10, B: 0, C: -6 }[priorities[question.id] ?? 'B'];
  const responseBoost = item.lastGrade === 'again' ? 12 : item.lastGrade === 'hard' ? 5 : 0;
  const lapseBoost = Math.min(12, (Number(item.lapses) || 0) * 2);
  const overdueBoost = Math.min(60, (overdueDays / interval) * 30);
  return (1 - boundedNumber(retrievability, 0, 1, 1)) * 100
    + overdueBoost
    + responseBoost
    + lapseBoost
    + priorityBoost;
}

function arrangeForFocus(items, workloadById, medianWorkload) {
  const remaining = [...items];
  const result = [];
  let previousChapter = null;
  let previousWasShort = null;

  while (remaining.length) {
    if (!result.length) {
      const first = remaining.shift();
      result.push(first);
      previousChapter = first.chapter?.number ?? null;
      previousWasShort = workloadById.get(first.id) <= medianWorkload;
      continue;
    }
    const searchLength = Math.min(FOCUS_WINDOW, remaining.length);
    let candidateIndex = 0;
    let fallbackIndex = 0;
    for (let index = 0; index < searchLength; index += 1) {
      const question = remaining[index];
      const chapter = question.chapter?.number ?? null;
      const isShort = workloadById.get(question.id) <= medianWorkload;
      if (chapter !== previousChapter && isShort !== previousWasShort) {
        candidateIndex = index;
        break;
      }
      if (index > 0 && fallbackIndex === 0 && (chapter !== previousChapter || isShort !== previousWasShort)) {
        fallbackIndex = index;
      }
      if (index === searchLength - 1) candidateIndex = fallbackIndex;
    }

    const [next] = remaining.splice(candidateIndex, 1);
    result.push(next);
    previousChapter = next.chapter?.number ?? null;
    previousWasShort = workloadById.get(next.id) <= medianWorkload;
  }

  return result;
}

function mixReviewsAndNew(reviews, unseen) {
  if (!reviews.length) return unseen;
  if (!unseen.length) return reviews;

  const result = [];
  let reviewIndex = 0;
  let unseenIndex = 0;
  const total = reviews.length + unseen.length;

  for (let position = 0; position < total; position += 1) {
    const expectedNew = Math.floor(((position + 1) * unseen.length) / total);
    const shouldUseNew = position > 0 && unseenIndex < expectedNew && unseenIndex < unseen.length;
    if (shouldUseNew || reviewIndex >= reviews.length) result.push(unseen[unseenIndex++]);
    else result.push(reviews[reviewIndex++]);
  }

  return result;
}

function selectBalancedWorkload(items, limit, workloadById, medianWorkload) {
  const shortItems = items.filter((question) => workloadById.get(question.id) <= medianWorkload);
  const longItems = items.filter((question) => workloadById.get(question.id) > medianWorkload);
  const selected = [
    ...shortItems.slice(0, Math.ceil(limit / 2)),
    ...longItems.slice(0, Math.floor(limit / 2)),
  ];

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((question) => question.id));
    selected.push(...items.filter((question) => !selectedIds.has(question.id)).slice(0, limit - selected.length));
  }

  const itemOrder = new Map(items.map((question, index) => [question.id, index]));
  return selected.sort((left, right) => itemOrder.get(left.id) - itemOrder.get(right.id));
}

export function buildDailyPlan(questions, progress, dailyLimit = DAILY_QUESTION_LIMIT, today = new Date(), priorities = {}) {
  const limit = Math.max(0, Math.trunc(Number(dailyLimit) || 0));
  const key = toDateKey(today);
  const workloadById = new Map(questions.map((question) => [question.id, questionWorkload(question)]));
  const workloads = Array.from(workloadById.values()).sort((left, right) => left - right);
  const medianWorkload = workloads[Math.floor((workloads.length - 1) / 2)] ?? 0;

  const due = questions.filter((question) => {
    const item = progress[question.id];
    return item?.due && item.due <= key;
  }).sort((left, right) => (
    reviewUrgency(right, progress, today, priorities) - reviewUrgency(left, progress, today, priorities)
    || priorityRank(left, priorities) - priorityRank(right, priorities)
    || left.id - right.id
  ));

  const unseen = questions.filter((question) => !progress[question.id]).sort((left, right) => (
    priorityRank(left, priorities) - priorityRank(right, priorities)
    || left.id - right.id
  ));

  const selectedDue = due.slice(0, limit);
  const selectedUnseen = selectBalancedWorkload(
    unseen,
    Math.max(0, limit - selectedDue.length),
    workloadById,
    medianWorkload,
  );
  const arrangedDue = arrangeForFocus(selectedDue, workloadById, medianWorkload);
  const arrangedUnseen = arrangeForFocus(selectedUnseen, workloadById, medianWorkload);

  return {
    queue: mixReviewsAndNew(arrangedDue, arrangedUnseen),
    dueCount: selectedDue.length,
    newCount: selectedUnseen.length,
    dueTotal: due.length,
    unseenTotal: unseen.length,
    deferredDueCount: Math.max(0, due.length - selectedDue.length),
  };
}

export function buildTodayQueue(questions, progress, dailyLimit = DAILY_QUESTION_LIMIT, today = new Date(), priorities = {}) {
  return buildDailyPlan(questions, progress, dailyLimit, today, priorities).queue;
}

export function dailyTarget(total, unseen, examDate, today = new Date(), dueCount = 0) {
  const remainingDays = Math.max(1, daysBetween(today, examDate));
  const consolidationDays = Math.max(3, Math.min(10, Math.ceil(remainingDays * 0.25)));
  const learningDays = Math.max(1, remainingDays - consolidationDays);
  const newQuestions = Math.ceil(unseen / learningDays);
  return Math.min(total, Math.max(1, dueCount + newQuestions));
}
