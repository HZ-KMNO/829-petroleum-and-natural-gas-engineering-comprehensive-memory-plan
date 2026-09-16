import { useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export function splitParagraph(text, clozes = []) {
  const parts = [];
  let cursor = 0;
  clozes.forEach((cloze, clozeIndex) => {
    if (cloze.start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, cloze.start) });
    parts.push({
      kind: 'fill',
      text: text.slice(cloze.start, cloze.end),
      clozeIndex,
      clozeType: cloze.clozeType ?? 'keyword',
    });
    cursor = cloze.end;
  });
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}

function TextPart({ part, revealed, revealOnClick, onReveal }) {
  if (part.kind !== 'fill') return part.text;
  if (revealed) return <span className="answer-fill">{part.text}</span>;

  const className = `answer-blank answer-blank-${part.clozeType}`;
  if (revealOnClick) {
    return (
      <button
        type="button"
        className={`${className} is-interactive`}
        data-cloze-type={part.clozeType}
        aria-label="显示此处答案"
        onClick={onReveal}
      ><span className="answer-blank-sizer" aria-hidden="true">{part.text}</span></button>
    );
  }
  return (
    <span
      className={className}
      data-cloze-type={part.clozeType}
      aria-label="待回忆内容"
    ><span className="answer-blank-sizer" aria-hidden="true">{part.text}</span></span>
  );
}

export function QuestionContent({ question, revealed = false, compact = false, revealOnClick = false }) {
  const [partialReveal, setPartialReveal] = useState(() => ({ questionId: question.id, clozes: new Set() }));
  const [revealedImages, setRevealedImages] = useState(() => ({ questionId: question.id, blocks: new Set() }));
  const blocks = useMemo(() => {
    const sourceBlocks = compact
      ? question.blocks.filter((block) => block.type === 'paragraph').slice(0, 1)
      : question.blocks;
    return sourceBlocks.map((block) => (
      block.type === 'paragraph' ? { ...block, parts: splitParagraph(block.text, block.clozes) } : block
    ));
  }, [compact, question]);
  const revealedClozes = partialReveal.questionId === question.id ? partialReveal.clozes : new Set();

  const revealCloze = (clozeKey) => {
    setPartialReveal((current) => {
      const clozes = current.questionId === question.id ? new Set(current.clozes) : new Set();
      clozes.add(clozeKey);
      return { questionId: question.id, clozes };
    });
  };

  const revealImage = (blockIndex) => {
    setRevealedImages((current) => {
      const blocks = current.questionId === question.id ? new Set(current.blocks) : new Set();
      blocks.add(blockIndex);
      return { questionId: question.id, blocks };
    });
  };

  return (
    <div className={`question-content ${compact ? 'is-compact' : ''}`}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'separator') return <div className="content-separator" key={blockIndex} />;
        if (block.type === 'spacer') return <div className="content-spacer" key={blockIndex} />;
        if (block.type === 'image') {
          const imageRevealed = revealed || (revealedImages.questionId === question.id && revealedImages.blocks.has(blockIndex));
          if (!imageRevealed && revealOnClick) {
            return <button className="question-image-blank" type="button" onClick={() => revealImage(blockIndex)} aria-label="显示公式图片" title="显示公式图片" key={blockIndex}><ImageIcon size={24} /></button>;
          }
          return <img className="question-image" src={block.src} alt={`第 ${question.id} 题公式图片`} key={blockIndex} />;
        }
        return (
          <p key={blockIndex}>
            {block.parts.map((part, partIndex) => {
              const clozeKey = `${blockIndex}:${part.clozeIndex}`;
              return (
                <TextPart
                  part={part}
                  revealed={revealed || revealedClozes.has(clozeKey)}
                  revealOnClick={revealOnClick}
                  onReveal={() => revealCloze(clozeKey)}
                  key={partIndex}
                />
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
