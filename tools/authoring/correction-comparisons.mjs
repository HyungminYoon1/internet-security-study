// Source summaries, not verbatim handout reproduction. Keys match the existing ledger.
const comparisons = {
  'w02-correction-11': {
    handoutExplanation: '2주차 22쪽 위쪽은 해시값을 수신자 공개키로 암호화한다고 설명하지만, 아래 서명 과정은 송신자 사설키를 사용한다고 설명한다.',
    verificationReason: 'NIST의 전자서명 정의는 서명 생성에 서명자의 개인키, 검증에 서명자의 공개키를 사용한다. 같은 페이지의 수신자 공개키 설명은 기밀성을 위한 수신자 대상 암호화와 서명 생성을 혼동한다. 모든 서명을 일반적인 개인키 암호화로 정의하지도 않는다.',
    reference: { title: 'NIST: 전자서명의 개인키 생성·공개키 검증', url: 'https://csrc.nist.gov/glossary/term/digital_signature' },
  },
  'w02-correction-10': {
    handoutExplanation: '2주차 21쪽은 해시가 다대일이어서 충돌이 필연적이라고 설명한 뒤, 충돌회피 조건에서는 사실상 1:1이라고 표현한다. 출력 길이는 항상 입력보다 짧다고도 적는다.',
    verificationReason: '고정된 유한 출력 공간에 더 많은 입력을 대응시키면 충돌이 존재한다. NIST는 충돌 저항성을 충돌하는 입력 쌍을 계산으로 찾기 매우 어려운 성질로 정의한다. 따라서 충돌이 없거나 일대일이라는 뜻이 아니다. 고정 길이 출력은 짧은 입력보다 길 수도 있다.',
    reference: { title: 'NIST: 충돌 저항성의 정의', url: 'https://csrc.nist.gov/glossary/term/collision_resistance' },
  },
  'w04-correction-06': {
    handoutExplanation: '4주차 16쪽은 DES 암호화를 9번 반복한다고 설명한다. 같은 교과의 2주차 17쪽과 18쪽에서는 16라운드로 제시한다.',
    verificationReason: 'NIST는 DES가 16라운드의 연산을 수행한다고 명시한다. 교안 내부에서도 2주차의 16라운드와 4주차의 9번 반복이 충돌하므로 DES 본체의 반복 횟수는 16으로 바로잡는다. 이는 3DES의 결합 적용 횟수와 다른 수치다.',
    reference: { title: 'NIST: DES의 16라운드 구조', url: 'https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/250-253.html' },
  },
  'w11-post-security': {
    handoutExplanation: '11주차 2쪽은 POST 파라미터를 본문으로 전송한다고 설명한 뒤, 헤더에 포함되어 노출되지 않고 길이 제한도 없으므로 GET보다 안전하다고 설명한다.',
    verificationReason: 'RFC 9110 §9.3.1·§17.9는 폼의 민감한 값을 URI 대신 요청 본문으로 보내는 POST의 이점을 설명하지만 POST 자체가 암호화인 것은 아니다. §4.2.2는 HTTPS의 기밀성·무결성 보호를, §15.5.14는 서버가 큰 요청을 413으로 거절할 수 있음을 명시한다.',
    reference: { title: 'IETF RFC 9110 §17.9: URI 노출과 POST 본문', url: 'https://www.rfc-editor.org/rfc/rfc9110.html#section-17.9' },
  },
  'w12-correction-02': {
    handoutExplanation: '12주차 3쪽은 GROUP BY 없이 HAVING만 쓰면 오류가 발생한다고 설명하며, 500 응답이나 따옴표 오류를 SQL 주입 취약점 확인과 연결한다.',
    verificationReason: 'Microsoft의 SQL Server HAVING 문서는 GROUP BY가 없으면 암시적인 단일 집계 그룹이 있다고 설명한다. 특정 쿼리의 다른 오류와 GROUP BY 부재를 구분해야 한다. HTTP 500 역시 서버 오류라는 상태만 나타내므로 SQL 주입의 성공이나 존재를 단독으로 증명하지 않는다.',
    reference: { title: 'Microsoft SQL Server: GROUP BY 없는 HAVING · 한국어', url: 'https://learn.microsoft.com/ko-kr/sql/t-sql/queries/select-having-transact-sql?view=sql-server-ver17' },
  },
  'w14-correction-08': {
    handoutExplanation: '14주차 17쪽은 find의 -ctime 검색을 최근 10일 동안 수정되거나 새롭게 생성된 파일 찾기로 설명한다.',
    verificationReason: 'Linux inode(7)은 ctime을 마지막 상태 변경 시각으로 정의하며 내용 쓰기 외에 소유자·권한 변경으로도 갱신된다고 설명한다. 내용 수정은 mtime, 지원되는 환경의 생성 시각은 btime으로 구분하므로 ctime만으로 최근 생성 파일이라고 판단할 수 없다.',
  },
};

export function applyCorrectionComparisons(week) {
  for (const correction of week.corrections) {
    const comparison = comparisons[correction.id];
    if (!comparison) continue;
    correction.handoutExplanation = comparison.handoutExplanation;
    correction.verificationReason = comparison.verificationReason;
    if (comparison.reference && !correction.references.some(ref => ref.url === comparison.reference.url)) {
      correction.references.push({ ...comparison.reference });
    }
  }
}
