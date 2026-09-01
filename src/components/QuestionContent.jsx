import { useMemo, useState } from 'react';

function Segment({ segment, revealed, revealOnClick, onReveal }) {
  const className = segment.markji ? 'markji' : undefined;
  if (segment.kind === 'fill') {
    if (revealed) {
      return <span className={`answer-fill ${className ?? ''}`}>{segment.text}</span>;
    }
    const width = Math.min(22, Math.max(3, Array.from(segment.text).length + 1));
    if (revealOnClick) {
      return (
        <button
          type="button"
          className={`answer-blank is-interactive ${className ?? ''}`}
          style={{ '--blank-width': `${width}em` }}
          aria-label="显示此处答案"
          onClick={onReveal}
        />
      );
    }
    return (
      <span
        className={`answer-blank ${className ?? ''}`}
        style={{ '--blank-width': `${width}em` }}
        aria-label="待回忆内容"
      />
    );
  }
  if (segment.kind === 'topic') {
    return <span className={`topic-mark ${className ?? ''}`}>{segment.text}</span>;
  }
  return <span className={className}>{segment.text}</span>;
}

export function QuestionContent({ question, revealed = false, compact = false, revealOnClick = false }) {
  const [partialReveal, setPartialReveal] = useState(() => ({ questionId: question.id, segments: new Set() }));
  const blocks = useMemo(() => {
    if (!compact) return question.blocks;
    const firstParagraph = question.blocks.find((block) => block.type === 'paragraph');
    return firstParagraph ? [firstParagraph] : [];
  }, [compact, question]);
  const revealedSegments = partialReveal.questionId === question.id ? partialReveal.segments : new Set();

  const revealSegment = (segmentKey) => {
    setPartialReveal((current) => {
      const segments = current.questionId === question.id ? new Set(current.segments) : new Set();
      segments.add(segmentKey);
      return { questionId: question.id, segments };
    });
  };

  return (
    <div className={`question-content ${compact ? 'is-compact' : ''}`}>
      {blocks.map((block, index) => {
        if (block.type === 'separator') return <div className="content-separator" key={index} />;
        if (block.type === 'spacer') return <div className="content-spacer" key={index} />;
        if (block.type === 'image') {
          return <img className="question-image" src={block.src} alt={`第 ${question.id} 题配图`} key={index} />;
        }
        return (
          <p key={index}>
            {block.segments.map((segment, segmentIndex) => {
              const segmentKey = `${index}:${segmentIndex}`;
              return (
                <Segment
                  segment={segment}
                  revealed={revealed || revealedSegments.has(segmentKey)}
                  revealOnClick={revealOnClick}
                  onReveal={() => revealSegment(segmentKey)}
                  key={segmentIndex}
                />
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
