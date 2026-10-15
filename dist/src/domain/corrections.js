// Evidence about technical content does not establish the instructor's answer key.
export function correctionReview(correction) {
  if (!['verified', 'contextualized', 'excluded'].includes(correction?.status)) throw new Error('정정 상태를 확인해 주세요.');
  const contextual = correction.status === 'contextualized', excluded = correction.status === 'excluded';
  return {
    handoutExplanation: correction.handoutExplanation ?? correction.issue,
    explanation: correction.corrected,
    verificationReason: correction.verificationReason ?? (excluded
      ? '교안의 해당 주장을 입증할 원자료를 확인하지 못했습니다. 아래 자료는 관련 개념을 설명하는 참고자료이며, 확인하지 못한 역사·수치를 입증하는 근거는 아닙니다.'
      : contextual
        ? '아래 근거 자료의 적용 조건·버전·판단 범위를 교안 설명과 함께 확인하세요. 과거 환경의 설명과 현재 환경의 설명은 적용 범위가 다를 수 있습니다.'
        : '아래 공식 자료의 정의·동작 조건을 기준으로 교안의 표현을 바로잡거나 그 한계를 보완했습니다.'),
    evidenceLabel: excluded ? '근거 미확인 · 앱 채점 제외' : contextual ? '조건·맥락 보완' : '기술 내용 정정',
    examReview: contextual ? 'conditional' : 'pending',
    examLabel: contextual ? '조건·버전 확인' : '교수님 확인 필요',
    examExplanation: contextual
      ? '문항에 제시된 버전·시점·분류 조건에 맞춰 답하세요. 문항에 조건이 없거나 교안과 검증한 내용 중 어느 기준인지 불분명하면 교수님께 확인해야 합니다. 실제 시험 채점 기준은 미확인입니다.'
      : excluded
        ? '이 앱에서는 해당 주장을 정답 암기·채점 대상으로 사용하지 않습니다. 실제 시험에서도 제외되는지, 어떤 설명을 요구하는지는 교수님 확인이 필요합니다. 실제 시험 출제·채점 기준은 미확인입니다.'
        : '정확한 내용으로 학습하되, 교안과 답이 달라지는 문항의 실제 시험 채점 기준은 미확인입니다. 시험 전에 정정 내용이 적용되는지 교수님께 확인하세요.',
  };
}

export function filterCorrections(corrections, { search = '', week = 'all', status = 'all' } = {}) {
  const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ko-KR');
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  return corrections.filter(c => {
    const review = correctionReview(c);
    if (week !== 'all' && c.week !== Number(week)) return false;
    if (status === 'pending' ? review.examReview !== 'pending' : status !== 'all' && c.status !== status) return false;
    const content = normalize([c.issue, review.handoutExplanation, review.explanation, review.verificationReason,
      c.examGuidance, review.examExplanation, `${c.week}주차`, c.pages.join(' '), ...c.references.map(r => r.title)].join(' '));
    return terms.every(term => content.includes(term));
  });
}

export function objectiveCorrections(data, objectiveId) {
  const ids = new Set(data.objectiveMap.get(objectiveId)?.correctionIds ?? []);
  return data.corrections.filter(c => ids.has(c.id));
}
