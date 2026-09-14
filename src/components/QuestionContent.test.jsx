import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionContent, splitParagraph } from './QuestionContent';

describe('splitParagraph', () => {
  it('renders clozes from ranges without fragmenting the source text', () => {
    const text = '每个孔隙所连通的喉道数。介于2~15之间。';
    const parts = splitParagraph(text, [
      { start: 2, end: 4, answer: '孔隙' },
      { start: 5, end: 7, answer: '连通' },
      { start: 8, end: 11, answer: '喉道数' },
      { start: 14, end: 18, answer: '2~15' },
    ]);

    expect(parts.filter((part) => part.kind === 'fill').map((part) => part.text))
      .toEqual(['孔隙', '连通', '喉道数', '2~15']);
    expect(parts.map((part) => part.text).join('')).toBe(text);
  });

  it('keeps adjacent semantic clozes separate', () => {
    const parts = splitParagraph('孔隙与喉道直径的比值。', [
      { start: 0, end: 2, answer: '孔隙' },
      { start: 3, end: 5, answer: '喉道' },
      { start: 5, end: 7, answer: '直径' },
    ]);

    expect(parts.filter((part) => part.kind === 'fill').map((part) => part.text))
      .toEqual(['孔隙', '喉道', '直径']);
  });

  it('renders a hidden formula image control before the answer is revealed', () => {
    const markup = renderToStaticMarkup(
      <QuestionContent
        question={{ id: 21, blocks: [{ type: 'image', src: '/formula.png' }] }}
        revealOnClick
      />,
    );

    expect(markup).toContain('aria-label="显示公式图片"');
    expect(markup).toContain('<svg');
  });
});
