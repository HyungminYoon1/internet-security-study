import { el, pill, meta, source } from './ui.js';
import { correctionReview } from '../domain/corrections.js';

export function correctionCard(correction, { id } = {}) {
  const review = correctionReview(correction);
  return el('details', { class: 'correction', id, 'data-review': review.examReview },
    el('summary', { class: 'correction-summary' },
      el('span', { class: 'correction-title' }, correction.issue),
      pill(review.examLabel, 'amber')),
    el('div', { class: 'correction-body' },
      meta(pill(review.evidenceLabel), source(correction.week, correction.pages)),
      el('div', { class: 'correction-comparison' },
        el('section', {}, el('h4', {}, '교안의 설명 · 요약'), el('p', {}, review.handoutExplanation)),
        el('section', {}, el('h4', {}, correction.status === 'excluded' ? '검토 결과' : '검증한 내용'), el('p', {}, review.explanation))),
      el('section', { class: 'correction-evidence' }, el('h4', {}, '수정·보완 근거'), el('p', {}, review.verificationReason),
        el('ul', {}, correction.references.map(ref => el('li', {},
          el('a', { href: ref.url, target: '_blank', rel: 'noopener noreferrer' }, `${ref.title} ↗`))))),
      el('section', { class: 'exam-clarification' }, el('h4', {}, review.examLabel), el('p', {}, review.examExplanation)),
      el('section', {}, el('h4', {}, '앱의 학습·채점 기준'), el('p', {}, correction.examGuidance))));
}
