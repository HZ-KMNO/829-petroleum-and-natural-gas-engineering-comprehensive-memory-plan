import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuestionContent } from '../components/QuestionContent';

const filters = [
  ['all', '全部'],
  ['new', '未学习'],
  ['learning', '学习中'],
  ['mastered', '已掌握'],
];

function plainText(question) {
  return question.blocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.text)
    .join('');
}

export function LibraryPage({ questions, progress, priorities, onOpenQuestion, mistakesOnly = false, viewState, onViewStateChange }) {
  const [localSearch, setLocalSearch] = useState('');
  const [localFilter, setLocalFilter] = useState(mistakesOnly ? 'mistakes' : 'all');
  const search = viewState?.search ?? localSearch;
  const filter = viewState?.filter ?? localFilter;
  const updateViewState = (next) => {
    if (onViewStateChange) onViewStateChange(next);
    else {
      if (next.search !== undefined) setLocalSearch(next.search);
      if (next.filter !== undefined) setLocalFilter(next.filter);
    }
  };

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      const item = progress[question.id];
      if (mistakesOnly && !(item?.lapses > 0)) return false;
      if (filter === 'new' && item) return false;
      if (filter === 'learning' && (!item || item.mastered)) return false;
      if (filter === 'mastered' && !item?.mastered) return false;
      if (query && !plainText(question).toLowerCase().includes(query) && !String(question.id).includes(query)) return false;
      return true;
    });
  }, [filter, mistakesOnly, progress, questions, search]);

  return (
    <section className="page library-page">
      <header className="page-header">
        <div><p className="date-label">{questions.length} 题完整版</p><h1>{mistakesOnly ? '错题本' : '全部题库'}</h1></div>
        <div className="result-count"><strong>{results.length}</strong><span>道题目</span></div>
      </header>

      <div className="library-controls">
        <label className="search-field">
          <Search size={19} />
          <input value={search} onChange={(event) => updateViewState({ search: event.target.value })} placeholder="搜索题目或编号" />
        </label>
        {!mistakesOnly && (
          <div className="filter-tabs"><SlidersHorizontal size={18} />{filters.map(([id, label]) => (
            <button className={filter === id ? 'active' : ''} onClick={() => updateViewState({ filter: id })} key={id}>{label}</button>
          ))}</div>
        )}
      </div>

      <div className="question-list">
        {results.map((question) => {
          const item = progress[question.id];
          const status = !item ? '未学习' : item.mastered ? '已掌握' : item.lapses > 0 ? '需加强' : '学习中';
          return (
            <button className="question-row" onClick={() => onOpenQuestion(question)} key={question.id}>
              <span className="row-number"><i>{priorities[question.id] ?? 'B'}</i>{String(question.id).padStart(3, '0')}</span>
              <div className="row-content"><div className="row-chapter">第 {question.chapter?.number ?? 0} 章 · {question.chapter?.title ?? '综合题'}</div><QuestionContent question={question} compact /></div>
              <span className={`status-text status-${status}`}>{status}</span>
            </button>
          );
        })}
        {results.length === 0 && <div className="empty-state"><Search size={28} /><p>没有找到符合条件的题目</p></div>}
      </div>
    </section>
  );
}
