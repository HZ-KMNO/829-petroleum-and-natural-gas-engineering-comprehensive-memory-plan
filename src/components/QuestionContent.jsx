import { useMemo } from 'react';

function Segment({ segment, revealed }) {
  const className = segment.markji ? 'markji' : undefined;
  if (segment.kind === 'fill') {
    if (revealed) {
      return <span className={`answer-fill ${className ?? ''}`}>{segment.text}</span>;
    }
    const width = Math.min(22, Math.max(3, Array.from(segment.text).length + 1));
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

export function QuestionContent({ question, revealed = false, compact = false }) {
  const blocks = useMemo(() => {
    if (!compact) return question.blocks;
    const firstParagraph = question.blocks.find((block) => block.type === 'paragraph');
    return firstParagraph ? [firstParagraph] : [];
  }, [compact, question]);

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
            {block.segments.map((segment, segmentIndex) => (
              <Segment segment={segment} revealed={revealed} key={segmentIndex} />
            ))}
          </p>
        );
      })}
    </div>
  );
}
