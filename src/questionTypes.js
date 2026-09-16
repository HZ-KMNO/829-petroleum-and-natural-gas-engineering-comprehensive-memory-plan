export const questionTypeOptions = [
  ['definition', '定义'],
  ['classification', '分类'],
  ['condition', '条件'],
  ['mechanism', '机理'],
  ['effect', '作用'],
  ['result', '结果'],
  ['formula', '公式'],
  ['value', '数值'],
  ['mnemonic', '口诀'],
  ['list', '条目'],
  ['example', '例子'],
];

const labels = Object.fromEntries(questionTypeOptions);

export function questionTypeLabel(type) {
  return labels[type] ?? '综合';
}
