import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReviewPage, advanceReviewSession } from './ReviewPage';

const question = (id) => ({
  id,
  category: 'definition',
  chapter: { number: 1, title: '储层岩石物理渗流基础' },
  blocks: [{
    type: 'paragraph',
    text: '孔隙与喉道的几何形状。',
    clozes: [{ start: 0, end: 2, answer: '孔隙', clozeType: 'keyword' }],
  }],
});

const renderReview = (overrides = {}) => renderToStaticMarkup(
  <ReviewPage
    queue={[question(1), question(2)]}
    plan={{ dueCount: 0, newCount: 2, deferredDueCount: 0 }}
    onGrade={() => {}}
    onPriority={() => {}}
    priorities={{}}
    todayReviewed={0}
    dailyTarget={2}
    {...overrides}
  />,
);

describe('review surface', () => {
  it('no longer asks for a free-text self answer', () => {
    const markup = renderReview();

    expect(markup).not.toContain('我的答案');
    expect(markup).not.toContain('answer-area');
    expect(markup).not.toContain('<textarea');
    expect(markup).not.toContain('答题骨架');
  });

  it('keeps the whole screen dedicated to the question and the grade buttons', () => {
    const markup = renderReview();

    expect(markup).toContain('review-surface');
    expect(markup).toContain('核对答案');
    expect(markup).toContain('question-content');
  });

  it('fills the viewport with the question when opened from the library', () => {
    const markup = renderReview({ focusedQuestion: question(37) });

    expect(markup).not.toContain('queue-position');
    expect(markup).not.toContain('<textarea');
    expect(markup).toContain('返回题库');
  });
});
