export const PATHWAYS = Object.freeze([
  { id: 'protection', exam: 'midterm', title: '무엇을, 어떤 위협으로부터 지킬까?', question: '기밀성·무결성·가용성을 구분하고 접근을 허용할 기준을 세웁니다.', steps: ['w01-cia', 'w01-threat', 'w03-accounts', 'w05-access-models', 'w06-boundary'] },
  { id: 'crypto', exam: 'midterm', title: '암호화와 전자서명은 어떻게 다를까?', question: '키의 역할에서 출발해 해시·서명·인증서·VPN을 연결합니다.', steps: ['w02-keys', 'w02-hash', 'w02-signature', 'w02-hybrid', 'w02-pki', 'w04-ahesp'] },
  { id: 'network', exam: 'midterm', title: '어디에서 통신을 보고 막을까?', question: '계층과 패킷을 이해한 뒤 방화벽·IDS·IPS의 차이를 판단합니다.', steps: ['w01-osi', 'w01-transport', 'w06-ordered-policy', 'w07-hids-nids', 'w07-fp-fn', 'w07-ips-enforcement'] },
  { id: 'web', exam: 'final', title: '입력값이 어떻게 공격이 될까?', question: 'HTTP와 신뢰 경계에서 SQL 삽입·XSS·객체 권한 검사를 구분합니다.', steps: ['w11-http-methods', 'w11-web-boundaries', 'w11-injection', 'w12-sql-boundary', 'w12-xss-context', 'w12-object-authorization'] },
  { id: 'wireless', exam: 'final', title: '연결되고 인증되면 안전할까?', question: '무선망의 도청 가능성과 접속 인증·키 관리의 역할을 따져 봅니다.', steps: ['w09-sniff', 'w09-authentication', 'w10-radio', 'w10-mac-filter', 'w10-wep', 'w10-keys-wpa'] },
  { id: 'evidence', exam: 'final', title: '경보가 울리면 무엇부터 확인할까?', question: '관측 사실과 추정을 나누고 여러 로그를 연결해 대응을 결정합니다.', steps: ['w13-log-evidence', 'w13-ids-patterns', 'w13-cross-device', 'w13-rule-design', 'w14-response-stages', 'w14-contain-recover', 'w14-linux-time-integrity'] }
]);

const BEFORE = Object.freeze({
  'w02-keys': ['w01-cia'], 'w02-hash': ['w01-cia'], 'w02-signature': ['w02-keys', 'w02-hash'],
  'w02-hybrid': ['w02-keys'], 'w02-pki': ['w02-signature'], 'w04-ahesp': ['w01-osi', 'w02-keys'],
  'w04-ike': ['w04-ahesp'], 'w03-permissions': ['w03-unixfiles'],
  'w05-access-models': ['w03-accounts'], 'w05-encryption-boundary': ['w02-keys', 'w02-hash'],
  'w05-key-lifecycle': ['w02-lifecycle'], 'w06-ordered-policy': ['w01-transport', 'w06-boundary'],
  'w07-hids-nids': ['w06-boundary'], 'w07-fp-fn': ['w07-intrusion-pipeline'],
  'w07-snort-options': ['w07-snort-header'], 'w07-ips-enforcement': ['w07-response', 'w07-fp-fn'],
  'w09-sniff': ['w01-network'], 'w09-password-storage': ['w02-hash'],
  'w10-wep': ['w10-radio'], 'w10-keys-wpa': ['w10-wep'],
  'w11-web-boundaries': ['w11-http-methods'], 'w11-injection': ['w11-web-boundaries'],
  'w12-sql-boundary': ['w11-injection'], 'w12-xss-context': ['w11-xss'],
  'w12-cookie-session': ['w11-session'], 'w12-object-authorization': ['w11-access'],
  'w13-log-evidence': ['w06-audit-alert'], 'w13-ids-patterns': ['w07-fp-fn'],
  'w13-cross-device': ['w13-log-evidence'], 'w13-rule-design': ['w13-cross-device'],
  'w14-response-stages': ['w13-log-evidence'], 'w14-contain-recover': ['w14-response-stages'],
  'w14-linux-time-integrity': ['w03-unixfiles', 'w13-log-evidence']
});

export function prerequisiteIds(id, catalog) {
  return [...new Set([...(catalog.objectiveMap.get(id)?.prerequisites ?? []), ...(BEFORE[id] ?? [])])];
}
