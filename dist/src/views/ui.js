export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'checked' || key === 'disabled' || key === 'hidden') node[key] = Boolean(value);
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
export const fragment = (...children) => { const f = document.createDocumentFragment(); children.flat(Infinity).filter(Boolean).forEach(c => f.append(c)); return f; };
export const btn = (label, action, kind = '', attrs = {}) => el('button', { type: 'button', class: `button ${kind}`, onclick: action, ...attrs }, label);
export const link = (label, href, kind = '') => el('a', { href, class: kind }, label);
export const pill = (label, kind = '') => el('span', { class: `pill ${kind}` }, label);
export const eyebrow = text => el('span', { class: 'eyebrow' }, text);
export const pageHead = (title, subtitle, action = null, kicker = '') => el('div', { class: 'page-head' }, el('div', {}, kicker && eyebrow(kicker), el('h1', { tabindex: '-1' }, title), subtitle && el('p', {}, subtitle)), action);
export const note = (text, kind = '') => el('div', { class: `notice ${kind}` }, text);
export const progress = (value, max, label) => el('progress', { class: 'progress', value, max: Math.max(1, max), 'aria-label': label }, `${value}/${max}`);
export const meta = (...items) => el('div', { class: 'meta-row' }, items);
export const empty = (title, copy, action = null) => el('section', { class: 'empty' }, el('h2', {}, title), el('p', {}, copy), action && el('div', { class: 'button-row' }, action));
export const source = (week, pages) => el('span', { class: 'muted' }, `${week}주차 교안 · ${pages.join(', ')}쪽`);
export const sectionHead = (title, more = null) => el('div', { class: 'section-head' }, el('h2', {}, title), more);
export const stat = (label, value, unit = '') => el('div', { class: 'stat' }, el('span', {}, label), el('strong', {}, value, unit && el('small', {}, unit)));
export const field = (label, input) => el('label', { class: 'field' }, label, input);
export function select(options, value, onChange, attrs = {}) {
  const node = el('select', { onchange: onChange, ...attrs }, options.map(([id, label]) => el('option', { value: id }, label)));
  node.value = value; return node;
}
export const prettyTime = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}`;
export const dateLabel = value => new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
