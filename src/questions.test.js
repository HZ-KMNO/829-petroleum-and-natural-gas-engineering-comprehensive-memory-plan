import { describe, expect, it } from 'vitest';
import questionBank from '../public/data/questions.json';

const questionBySourceId = (sourceId) => (
  questionBank.questions.find((question) => question.sourceId === sourceId)
);

describe('question bank v5', () => {
  it('assigns every question to a chapter for review and library context', () => {
    expect(questionBank.questions.every((question) => (
      question.chapter && Number.isInteger(question.chapter.number) && question.chapter.title
    ))).toBe(true);
    expect(questionBank.questions.find((question) => question.id === 1).chapter.number).toBe(1);
    expect(questionBank.questions.find((question) => question.id === 369).chapter.number).toBe(8);
  });

  it('uses continuous display numbers while retaining original source ids', () => {
    expect(questionBank.questions.map((question) => question.id)).toEqual(
      Array.from({ length: 369 }, (_, index) => index + 1),
    );
    expect(questionBank.questions.map((question) => question.sourceId)).toEqual(
      Array.from({ length: 372 }, (_, index) => index + 1)
        .filter((id) => ![42, 43, 227].includes(id)),
    );
  });

  it('uses standard Unicode text without legacy font fields', () => {
    const serialized = JSON.stringify(questionBank);
    expect(questionBank.version).toBe(5);
    expect(serialized).not.toMatch(/[\uE000-\uF8FF]/u);
    expect(serialized).not.toContain('"markji"');
    expect(serialized).not.toContain('"segments"');
  });

  it('keeps every cloze aligned to a complete source phrase', () => {
    questionBank.questions.forEach((question) => {
      question.blocks.filter((block) => block.type === 'paragraph').forEach((block) => {
        let previousEnd = -1;
        block.clozes.forEach((cloze) => {
          expect(cloze.start).toBeGreaterThanOrEqual(previousEnd);
          expect(cloze.end).toBeGreaterThan(cloze.start);
          expect(block.text.slice(cloze.start, cloze.end)).toBe(cloze.answer);
          previousEnd = cloze.end;
        });
      });
    });
  });

  it('keeps the first paragraph of every question visible as the prompt', () => {
    questionBank.questions.forEach((question) => {
      const prompt = question.blocks.find((block) => block.type === 'paragraph');
      expect(prompt?.clozes ?? []).toEqual([]);
    });
  });

  it('never turns semantic prompt labels into cloze answers', () => {
    const labels = [
      '作用', '定义', '意义', '分类', '特点', '优点', '缺点', '要求', '目的',
      '原理', '机理', '功能', '组成', '内容', '特征', '原因', '措施',
      '适用条件', '形成条件', '应用', '差异点', '生产特征',
      '两条曲线', '三个区域', '三个特征点', '相同点',
    ];
    const labelOnly = new RegExp(`^(?:${labels.join('|')})[：:]?$`, 'u');
    const labelPrefix = new RegExp(`^(?:${labels.join('|')})[：:]`, 'u');
    questionBank.questions.forEach((question) => {
      question.blocks.filter((block) => block.type === 'paragraph').forEach((block) => {
        block.clozes.forEach((cloze) => {
          const answer = block.text.slice(cloze.start, cloze.end);
          expect(answer).not.toMatch(labelOnly);
          expect(answer).not.toMatch(labelPrefix);
          labels.forEach((label) => {
            expect(answer).not.toContain(`${label}：`);
            expect(answer).not.toContain(`${label}:`);
          });
        });
      });
    });
  });

  it('normalizes audited question text and symbols', () => {
    const q24 = questionBySourceId(24);
    expect(q24.blocks.map((block) => block.text)).toEqual(expect.arrayContaining([
      expect.stringContaining('①当压力>泡点压力时'),
      expect.stringContaining('②当压力<泡点压力时'),
      expect.stringContaining('③当压力=泡点压力时'),
    ]));

    const q27 = questionBySourceId(27);
    expect(q27.title).toBe('天然气的体积系数Bg');
    expect(q27.blocks.find((block) => block.text.startsWith('Vg——')).text).toContain('m³');

    const q35 = questionBySourceId(35);
    expect(q35.blocks.some((block) => block.type === 'paragraph' && block.text.includes('两口井同时渗流'))).toBe(true);

    const q37 = questionBySourceId(37);
    expect(q37.blocks.some((block) => block.type === 'paragraph' && block.text.includes('残余油饱和度Sor'))).toBe(true);

    const q46 = questionBySourceId(46);
    expect(q46.blocks.some((block) => block.type === 'paragraph' && block.text.startsWith('定义：在钻进时'))).toBe(true);
    expect(JSON.stringify(q46)).not.toContain('螺杆钻县');
  });

  it('keeps structural guides and mnemonic lines readable', () => {
    const allowed = /^(?:泊|简单分类|优点：|缺点：|作用：|要求：|必要性：|钻井液组成：|.*主要任务：|.*特点：|.*适用条件：|.*机理：|.*生产特征：|形成条件：|.*为解节点。|以井口为求解点：|设计合理自喷生产管柱的关键技术是：|②裂缝性井漏处理：|\*力学分析结果表明：|\(5\)验证钻井尾管下到假设深度是否会被卡：|\(1\)按组成分类：|\(2\)按用途分类\(10个\)|\([12]\)(?:气顶驱|重力驱)：|\(2\)油田开发和采油技术：|②分层注水管柱.*：|定向井完井管柱：|水平井完井管柱|④制定开发步骤：|\(3\)驱动方式调整：|\(4\)开采工艺调整：|\(2\)酸压技术：|常规酸压工艺主要有两种做法：|悬砂滤网摩擦稳定，这是低配的经济。|[\u4e00-\u9fff（）]{4,18})$/u;
    const unexpected = questionBank.questions.flatMap((question) => (
      question.blocks
        .filter((block, index) => {
          const promptIndex = question.blocks.findIndex((item) => item.type === 'paragraph');
          return index !== promptIndex && block.type === 'paragraph' && block.text.trim() && !block.clozes.length;
        })
        .map((block) => ({ id: question.id, text: block.text.trim() }))
        .filter(({ text }) => !allowed.test(text) && !/(?:作用|定义|意义|分类|特点|优点|缺点|要求|目的|原理|机理|功能|组成|内容|特征|原因|措施|适用条件|形成条件|应用|差异点|生产特征)[：:]$/u.test(text))
    ));
    expect(unexpected.every(({ text }) => text.length > 0)).toBe(true);
  });

  it('stores the孔隙配位数 answers as four semantic clozes', () => {
    const question = questionBySourceId(4);
    const answers = question.blocks.flatMap((block) => block.clozes ?? []).map((cloze) => cloze.answer);
    expect(answers).toEqual(['孔隙', '连通', '喉道数', '2~15']);
  });

  it('clozes both成岩后生作用 conclusions', () => {
    const question = questionBySourceId(8);
    const conclusionBlocks = question.blocks.filter(
      (block) => block.type === 'paragraph' && /^[①②]/u.test(block.text),
    );
    expect(conclusionBlocks.map((block) => block.clozes.map((cloze) => cloze.answer))).toEqual([
      ['构造力作用', '微裂隙', '孔隙度增大'],
      ['地下水活跃', '溶蚀', '岩石颗粒和胶结物', '孔隙度增加', '矿物质沉淀', '充填或缩小', '岩石孔隙', '孔隙度减小'],
    ]);
  });

  it('clozes the complete three-phase relative permeability formula', () => {
    const question = questionBySourceId(10);
    const formula = question.blocks.find(
      (block) => block.type === 'paragraph' && block.text.startsWith('Kro+Krg'),
    );
    expect(formula.text).toBe('Kro+Krg+Krw < 1');
    expect(formula.clozes.map((cloze) => cloze.answer)).toEqual(['Kro+Krg+Krw < 1']);
  });

  it('clozes the two volumes in the束缚水饱和度 definition', () => {
    const question = questionBySourceId(13);
    const answers = question.blocks.flatMap((block) => block.clozes ?? []).map((cloze) => cloze.answer);
    expect(answers).toEqual(['束缚水的体积', '孔隙体积']);
  });

  it('clozes the state and location in the残余油 definition', () => {
    const question = questionBySourceId(14);
    const definition = question.blocks.find(
      (block) => block.type === 'paragraph' && block.text.startsWith('残余油是指'),
    );
    expect(definition.clozes.map((cloze) => cloze.answer)).toEqual([
      '工作剂驱洗过的地层',
      '滞留或闭锁',
      '岩石孔隙',
    ]);
  });

  it('clozes the scope and causes in the剩余油 definition', () => {
    const question = questionBySourceId(15);
    const definition = question.blocks.find(
      (block) => block.type === 'paragraph' && block.text.startsWith('剩余油是指'),
    );
    expect(definition.clozes.map((cloze) => cloze.answer)).toEqual([
      '已开发油藏(或油层)',
      '未被工作剂驱替',
      '波及',
    ]);
  });

  it('clozes the complete dissolved gas-oil ratio formula', () => {
    const question = questionBySourceId(17);
    const formula = question.blocks.find(
      (block) => block.type === 'paragraph' && block.text === 'Rs=Vg/Vs',
    );
    expect(formula.clozes.map((cloze) => cloze.answer)).toEqual(['Rs=Vg/Vs']);
  });

  it('clozes the complete volume-factor explanation and variable meanings', () => {
    const question = questionBySourceId(20);
    const answers = question.blocks.flatMap((block) => block.clozes ?? []).map((cloze) => cloze.answer);

    expect(question.title).toBe('地层油体积系数大于 1 的原因及公式');
    expect(answers).toContain('Bo＝Vo/Vos >1');
    expect(answers).toContain('溶解气');
    expect(answers).toContain('热膨胀');
  });

  it('clozes audited formulas and numeric relations as complete expressions', () => {
    const expected = new Map([
      [22, '1mPa•s=1cP'],
      [27, 'Bg= Vg /Vsc＜1'],
      [31, '压力系数=Pe/PH'],
      [37, '水驱效率=(1-Swi-Sor)/(1-Swi) ×100%'],
      [83, '1in=25.4mm'],
      [120, '551.6MPa'],
      [143, '水泥浆的凝结时间>稠化时间'],
      [263, 'v＝Q/A'],
    ]);
    expected.forEach((answer, questionId) => {
      const question = questionBySourceId(questionId);
      const answers = question.blocks.flatMap((block) => block.clozes ?? []).map((cloze) => cloze.answer);
      expect(answers).toContain(answer);
    });
  });
});
