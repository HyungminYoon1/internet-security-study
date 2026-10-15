# 콘텐츠 저작 검토 기록: Part 2

작성·검증일: 2026-10-15. 담당 범위는 5·6·7주차 JSON과 이 기록, `tools/authoring/part-2.mjs`다. 앱/UI/공통 테스트/배포 설정은 변경하지 않았다.

## 결과

| 주차 | 학습목표 | 독립 문항/문항군 | 정정 기록 | verified | contextualized | excluded | PDF 페이지 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 15 | 48 | 11 | 5 | 5 | 1 | 28/28 |
| 6 | 12 | 50 | 10 | 4 | 5 | 1 | 24/24 |
| 7 | 14 | 53 | 16 | 10 | 5 | 1 | 31/31 |
| 합계 | 41 | 151 | 37 | 19 | 15 | 3 | 83/83 |

각 목표는 동기, 원인·결과를 설명하는 한국어 2문단 이상, 비교 2행 이상, 풀이 단계 2개 이상, 오개념과 이유, 회상 확인을 포함한다. 각 목표에 3개 이상 직접 저작한 문항이 있다. 모든 문항은 4개의 서로 다른 선택지, 선택지별 이유, 하나의 정답, 원문 페이지를 가진다. 최소 목표 45/50/50보다 늘어난 문항은 MAC의 강제 정책, 오류·접근 감사와 복제 로그의 차이, IPS 운영과 WAF 구성의 별도 학습을 위해 작성했다.

## 명시된 자료의 확인 범위

| 자료 | 상태 | 확인 내용·선택 한계 |
| --- | --- | --- |
| `architecture.md` | VERIFIED | 전부 먼저 읽음. 계층·배포 범위·콘텐츠 진실성·인코딩 원칙 준수. |
| `docs/content-contract.md` | VERIFIED | 전부 먼저 읽음. 스키마·문항군·최소 내용·페이지 매핑·정정 상태 확인. |
| 지정된 PDF 스킬의 `SKILL.md` (저장소 외부) | VERIFIED | 전부 읽고 pypdf 텍스트와 도표 PNG를 함께 확인. 공개 문서에는 개인별 설치 경로를 기재하지 않음. |
| `.gitattributes` | VERIFIED | 전부 읽음. 텍스트 CRLF, 이미지 binary 규칙 확인. |
| `../../2026-2학기/인터넷보안/교안` 디렉터리 | PARTIAL | 전체 파일명·크기를 목록화. 담당 PDF 3개만 내용 전부 검토. 다른 주차는 분담 범위 밖이므로 본문 미검토. |
| `[교안]인터넷보안_05.pdf` | VERIFIED | pypdf로 1~28쪽 전체 읽음. 6·25·26·27쪽 도표 시각 확인. |
| `[교안]인터넷보안_06.pdf` | VERIFIED | pypdf로 1~24쪽 전체 읽음. 9·10·21·22·24쪽 시각 확인. 24쪽은 쪽 번호뿐인 빈 페이지. |
| `[교안]인터넷보안_07.pdf` | VERIFIED | pypdf로 1~31쪽 전체 읽음. 4·8·14·15·23·27·28쪽 시각 확인. |
| 지정 임시 렌더 디렉터리와 `render-deps` | PARTIAL | 기존 담당 PNG와 pypdfium2 렌더 의존성만 사용. 다른 주차 PNG와 의존성 코드 전체는 검토 대상 아님. |
| `dist/src/domain/content.js` | VERIFIED | 전달된 `validateWeek()` 포함 파일 전체를 읽고 해당 함수로 각 주차를 독립 검증. 파일 수정 없음. |

경로는 앱 저장소 루트를 기준으로 표시한다. 시각 확인은 총 16페이지다. 추가 렌더 8개는 저장소 밖 `../../tmp/pdfs/internet-security-design-20261015`에 `part2-wNN-pNN.png`로 생성했다. 기존 렌더는 수정하지 않았다. PDF 원본·스크린샷·실제 공격 대상은 앱 JSON에 포함하지 않았다. 표지·목표·정리와 본문이 섞인 페이지는 본문 목표와 연결했고, 순수 행정 페이지만으로 분리할 페이지는 없었다. 6주차 24쪽은 `blank`와 제외 사유로 처리했다. 페이지별 정확한 내용·목표 연결은 각 JSON의 `coverage`에 83개 항목으로 기록했다. 일부 코드는 구형 예시임을 알리기 위해 `historical`로 표시했다.

## 학습목표별 문항 수

| 목표 ID | 학습 범위 | 문항 |
| --- | --- | ---: |
| w05-db-goals | 기밀성·무결성·가용성·인증·추론과 행위 증거 | 3 |
| w05-access-models | DAC·MAC·RBAC, ACL·capability와 실효 권한 | 4 |
| w05-account-lifecycle | 퇴직·만료·시험·기본 계정의 수명 관리 | 3 |
| w05-authentication-policy | 실패 제한·잠금·비밀번호와 버전별 검증 | 3 |
| w05-environment-separation | 개발·운영 연결·계정·시험 자료의 분리 | 3 |
| w05-public-privileges | PUBLIC·상속 권한의 확산과 제한 | 3 |
| w05-admin-privileges | DBA·개인별 책임·OS 관리 인증 | 3 |
| w05-backup-recovery | 백업·복원·키와 가용성 | 3 |
| w05-service-exposure | 샘플 DB·원격 접속·네트워크와 인증 경계 | 3 |
| w05-audit-operations | 감사·오류·일반·느린 질의·복제 로그 | 5 |
| w05-encryption-boundary | 저장·전송·정상 복호화와 비밀번호 검증값 | 3 |
| w05-crypto-db-integration | H/W·S/W DB 연동과 인가 모형의 다른 축 | 3 |
| w05-crypto-app-integration | H/W·S/W 응용 연동, SDK·평문 로그·키 서비스 | 3 |
| w05-crypto-rollout | 대상·임시 공간·전환·정확성·기능·성능 시험 | 3 |
| w05-key-lifecycle | 키의 사용 권한·교체·복구 의존성 | 3 |
| w06-boundary | 호스트·네트워크 경계·우회·내부 통신 | 4 |
| w06-identity | 식별·인증·인가와 OTP의 목적·한계 | 4 |
| w06-integrity-vpn | 무결성·터널·VPN 종단과 구형 암호 | 4 |
| w06-audit-alert | 로그·경보·저장 장애와 사건 해석 | 4 |
| w06-nat | 출발지·목적지 변환, 포트 대응과 접근통제 | 4 |
| w06-components | 필터·제어·인증·기록·원격관리 역할 | 4 |
| w06-ordered-policy | 최초 일치·기본 거부·규칙 가림·빈 표 행 | 5 |
| w06-packet-filter | 헤더·상태·내용, 메커니즘과 구축 형태 | 4 |
| w06-circuit | 서킷 중계와 클라이언트 지원 범위 | 4 |
| w06-application-hybrid | 응용 문맥·신규 서비스·혼합 정책 비용 | 4 |
| w06-topology | Dual-Homed·Bastion·Screened Host·Subnet·DMZ | 5 |
| w06-operations | 선정·부하·변경 복구·임시 예외·근거 | 4 |
| w07-intrusion-pipeline | 침입 시도·성공·내부 오용과 탐지 단계 | 3 |
| w07-hids-nids | 로컬 행위·통신 흐름·센서 자체 보호 | 4 |
| w07-detection-methods | 오용·이상·프로토콜 문맥과 튜닝 | 4 |
| w07-sensor-placement | 경계 전후·내부·DMZ, Manager·Sensor | 3 |
| w07-response | 수동·능동·연동·인라인 집행과 영향 | 4 |
| w07-fp-fn | FP·FN·재현율·정밀도와 분모 | 5 |
| w07-visibility-evasion | 패킷 손실·암호화·단편·해석 일치 | 4 |
| w07-snort-pipeline | 수집·디코더·전처리·탐지·출력·버전 | 4 |
| w07-snort-header | 헤더 필드·방향·동작·인라인·포트 범위 | 4 |
| w07-snort-options | content·nocase·offset·depth·sid·rev·flow | 5 |
| w07-ips-enforcement | 인라인·선택 차단·상위 병목 | 3 |
| w07-ips-operations | 오탐 피해·실부하·장애 동작과 복구 | 3 |
| w07-waf-purpose | 웹 문맥·응용 보안·TLS 가시성 | 3 |
| w07-waf-engine | URL 해석·정규화·정책 조합·미러·좁은 예외 | 4 |

## 정정 목록

아래 접미사는 JSON의 `wNN-correction-접미사`에 대응한다. 정확한 문제·정정 설명·시험 학습 지침·방문한 1차 출처 URL은 각 레코드에 포함했다. `verified`는 명시된 기능·정정 내용에 대한 출처 확인이며 제품의 실제 배포 시험을 뜻하지 않는다. `excluded`의 참고 링크는 개념의 근거이고 미확인 비율의 원자료라는 뜻이 아니다.

| 주차 | 정정 접미사 | 원문 페이지 | 상태 |
| --- | --- | --- | --- |
| 5 | access-model | 4,5,6 | contextualized |
| 5 | stats | 1 | excluded |
| 5 | password | 9,10,12,13 | contextualized |
| 5 | db-version | 10,11,12,16,17,21,23 | verified |
| 5 | separation | 14 | contextualized |
| 5 | os-auth | 18 | verified |
| 5 | network | 21 | verified |
| 5 | audit | 22,23 | verified |
| 5 | encryption | 24 | verified |
| 5 | password-storage | 28 | contextualized |
| 5 | integration | 25,26,27 | contextualized |
| 6 | scope | 3,12 | verified |
| 6 | dac | 4 | verified |
| 6 | otp | 4 | contextualized |
| 6 | crypto | 5,7,8,9 | contextualized |
| 6 | nat | 6,23 | verified |
| 6 | ordering | 10,14 | contextualized |
| 6 | implementation | 8,9 | contextualized |
| 6 | mechanisms | 13,14,15,16,17,18 | verified |
| 6 | topology | 19,21,22,23 | contextualized |
| 6 | stats | 12 | excluded |
| 7 | sensor | 4,7 | verified |
| 7 | encrypted | 4,7,12,13 | verified |
| 7 | detection | 5,6,25 | verified |
| 7 | placement | 8,9 | verified |
| 7 | stats | 9 | excluded |
| 7 | active | 6,10,18,19,25 | verified |
| 7 | evasion | 13 | contextualized |
| 7 | snort-version | 14,15,16,27,29,30 | contextualized |
| 7 | snort-actions | 16,31 | verified |
| 7 | snort-direction | 17 | verified |
| 7 | snort-options | 17 | contextualized |
| 7 | ips-guarantees | 20,21,24 | verified |
| 7 | performance | 21,22 | contextualized |
| 7 | product | 18,19,25,26,31 | verified |
| 7 | waf | 26,31 | contextualized |
| 7 | waf-model | 27,28,29,30,31 | verified |

핵심 방문 출처는 [NIST 방화벽 지침](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-41r1.pdf), [NIST IDPS 지침](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-94.pdf), [NIST 비밀번호 지침](https://pages.nist.gov/800-63-4/sp800-63b.html), [Oracle TDE](https://docs.oracle.com/en/database/oracle/oracle-database/19/asoag/introduction-to-transparent-data-encryption.html), [Oracle 감사 설정](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/AUDIT_TRAIL.html), [MySQL 계정 관리](https://dev.mysql.com/doc/refman/8.4/en/account-management-statements.html), [Snort 동작](https://docs.snort.org/rules/headers/actions), [Snort URI](https://docs.snort.org/rules/options/payload/http/uri), [OWASP WAF](https://community.owasp.org/Web_Application_Firewall), [CRS 문서](https://coreruleset.org/docs/index.print), [RFC 4732](https://www.rfc-editor.org/rfc/rfc4732.html)다. 긴 외부 문서는 해당 주장과 관련된 절을 확인했으며 외부 문서 전체를 읽었다고 주장하지 않는다. 전체 사용 링크는 JSON `references`와 정정 레코드에 있다.

## 콘텐츠 결정 기록

| 맥락 | 검토한 선택 | 결정·이유 | 영향 파일 | 후속 검토 |
| --- | --- | --- | --- | --- |
| 구형 설명과 현대 기준의 충돌 | 교안 단정 유지 / 최신 내용으로 출처 없이 대체 / 맥락과 정정 분리 | 마지막 방식을 선택. 교안 학습 범위를 보존하면서 알려진 오류를 정답으로 만들지 않음. | 세 JSON, 저작 MJS | 실제 시험의 출제·채점 기준은 확인되지 않음. |
| 내부자 비율 원자료 부재 | 비율 암기 / 임의 수치 교체 / 사실 채점 제외 | 90·70·75%를 excluded로 처리. 실제 위험은 경로·권한·관찰로 설명. | 세 JSON | 원자료를 확보하면 모집단·시점부터 재검토. |
| 순서 규칙 연습 | 제품 불문 암묵 순서 / 명시한 결정 모델 | 결합 조건 전부 일치, 위에서부터 최초 일치 후 종료를 명시. 빈 2번 행에 조건을 창작하지 않음. | week-06.json, MJS | 실제 제품의 우선순위·상태 예외는 범위 밖. |
| 접근 모형과 배치의 혼동 | DAC·H/W·DMZ를 한 분류로 나열 / 설계 축 분리 | 인가 모형·암호 실행 위치·검사 메커니즘·네트워크 배치를 구별. | 세 JSON, MJS | 제품별 결합은 지원 범위를 확인. |
| IDS·IPS의 절대 구분 | IDS는 절대 대응 불가 / 목적·기능·경로 구분 | 능동 연동 가능성과 인라인 집행의 차이를 별도 설명. | week-07.json, MJS | 실제 차단 성공은 라이브 검증하지 않음. |
| 부하·자동 대응·가용성 | 숫자·최대 처리량 단독 판정 / 실부하·오탐 영향·장애 정책 | 후자를 선택. 정확성·업무 지속과 복구를 함께 평가. | week-06.json, week-07.json, MJS | 실제 배포 정책 결정이나 설정 변경 없음. |
| 사례의 안전성·저작권 | 원본 그림·실제 대상·실행 공격문 재사용 / 가상·무해 자료와 독자 설명 | 후자를 선택. XXSAFEYY, 가상 구역 등으로 판단 과정을 설명. | 세 JSON | 원본 PDF와 PNG는 dist 밖에 유지. |
| 저작·생성 방식 | 런타임 변형 증식 / 명시적 원본 레코드 직렬화 | 문항당 q 호출 1회. build에서 선택지 위치만 고정 분산하고 복제 문항을 생성하지 않음. | MJS, 세 JSON | 원본 레코드와 생성 결과의 결정성 유지. |

기존 5·6주차 최초 생성 후 문항 ID를 이동시키지 않고 추가 문항은 5주차 끝의 q046~q048에 배치했다. 모든 문항군은 개별 추론 문제를 가리킨다. 선수 개념은 모두 빈 목록이며 다른 작업자의 목표 ID를 가정하지 않는다. 앱의 저장·보존·접근제어 정책이나 문서화된 아키텍처를 변경하지 않았다.

## 실행한 검증과 재현

저장소 루트에서 `node tools/authoring/part-2.mjs`를 실행한다. 이 명령은 담당 세 JSON만 생성하며 각 파일에 `validateWeek()`를 적용한다. 전체 13개 주차를 요구하는 `buildCatalog()`는 사용하지 않았다.

검증 통과 항목은 스키마·정확한 원문 파일명/페이지 수·목표/문항/정정 링크·4개 고유 선택지·정답 존재·한국어 설명 문단별 한글 25자 이상·목표당 3문항 이상·원문 83쪽 전부 매핑·목표 및 문항의 각 출처 페이지와 coverage 연결·중복 프롬프트/문항군 없음·자기 주차 밖 선수 ID 없음·JSON 왕복 동등성·UTF-8 BOM 없음·CRLF·문자 대체 표식 없음이다.

최종 검증 범위는 콘텐츠 스키마와 저작 무결성이다. 브라우저/UI·공통 도메인 회귀·CI·라이브 보안 장비 동작·출판은 본 작업에서 수행하지 않았다. 다른 작업자의 파일이나 Git 설정을 수정하지 않았고 커밋·푸시·게시·추가 에이전트 실행을 하지 않았다.

## 미해결 사실과 제외 범위

내부자 비율 세 건의 정확한 원자료는 미확인이다. 최신 국내 법령의 암호화 대상·의무 주기·공식 시험 문항 수/배점도 이 자료에서 확정하지 않는다. 구형 제품의 실제 설치 상태·모든 버전의 명령 호환성은 확인하지 않았으며 옛 명령 실행법으로 재출판하지 않았다. CISA 일부 페이지는 접근 시 403이어서 검증 출처에 사용하지 않았고, 서비스 거부의 한계는 실제 열람한 RFC 4732와 NIST 문서로 확인했다. 미확인 사실을 참으로 요구하는 문항은 없다.
