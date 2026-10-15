# 콘텐츠 감사 Part 3: 9·10·11주차

작성 및 확인일: 2026-10-15. 범위: 콘텐츠 저작 및 개별 파일 검증. 앱·UI·저장소·테스트 구현·Git 설정·커밋·게시 작업은 담당 범위가 아니다.

## 산출물과 검증 결과

| 주차 | 목표 | 문항 | 독립 family | 학습목표 | 정정 | 원문 쪽 | 쪽 대응 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 9 | 55 | 60 | 60 | 12 | 12 | 28 | 1-28 전체 |
| 10 | 35 | 35 | 35 | 7 | 12 | 28 | 1-28 전체 |
| 11 | 35 | 45 | 45 | 11 | 13 | 23 | 1-23 전체 |
| 합계 | 125 | 140 | 140 | 30 | 37 | 79 | 누락 없음 |

정정 상태: 9주차 verified 7 / contextualized 5, 10주차 verified 5 / contextualized 7, 11주차 verified 6 / contextualized 7. contextualized에는 역사적 조건, 적용 한계, 미확인 수치의 비채점 처리가 포함된다. 불확실한 명제를 정답으로 사용하지 않았다.

`tools/authoring/part-3.mjs`에 실제 해설·문항·오답 이유를 개별 작성했다. q 호출 하나가 JSON 문항 하나를 만들며, 옵션 순열·문구 치환·자동 변형으로 수를 늘리지 않는다. 실행 시 지정한 세 JSON만 출력한다. 각 문항은 별도 사고 대상을 가진 family이며 서로 같은 문항을 재배열한 변형은 없다.

다음 개별 검증이 통과했다.

- 부모의 `dist/src/domain/content.js`에서 `validateWeek()`를 가져와 생성 전 및 JSON 재파싱 후 검증.
- 정확한 주차·파일명·쪽수·최종시험 분류, 목표/정정 연결, 비교표 2행 이상, 해설 2문단 이상, 예시 2단계 이상.
- 목표별 문항 최소: 9주차 5, 10주차 5, 11주차 4. 실제 최소 목표를 상회한다.
- 문항 ID·발문 중복 없음, 고유 보기 4개와 정답 ID 1개, 보기별 이유, 질문의 sourcePages가 소속 목표의 pages에 포함.
- 전체 원문 쪽 대응, 공백 쪽 명시, HTTPS 참고 URL의 구조 검증, UTF-8 무BOM·CRLF 확인.
- 공격 명령·실제 표적 주소·작동 스크립트·eval 문자열의 세 JSON 대상 정적 검색에서 일치 없음.

정답 위치 수: 9주차 a18/b17/c13/d12, 10주차 a11/b10/c7/d7, 11주차 a11/b11/c12/d11. 보기 위치를 자동 순환하여 문항 수를 늘리지 않았다.

앱 통합·브라우저 UI·전체 13주차 buildCatalog·전체 테스트·CI·공개 배포는 이 작업자가 검증한 결과가 아니다. `git status`는 이 디렉터리에 Git 저장소가 없어 수행 결과를 얻지 못했으며, Git 설정 변경이나 초기화는 하지 않았다.

## 명명된 자료의 점검 범위

| 자료 | 상태 | 확인 범위 |
| --- | --- | --- |
| architecture.md | VERIFIED | 콘텐츠 작성 전 전체 읽음. 레이어·배포·진실성 정책 준수. |
| docs/content-contract.md | VERIFIED | 콘텐츠 작성 전 전체 읽음. 스키마·목표별 저작 요구·최소 문항 목표 적용. |
| PDF skill | VERIFIED | 작업자가 직접 전체 읽음. pypdf와 렌더 시각 점검을 함께 수행. |
| 교안 디렉터리 | PARTIAL | 파일명 전체 목록화. 배정된 09·10·11 PDF만 전체 내용 검토. 나머지 주차는 타 작업자 범위. |
| [교안]인터넷보안_09.pdf | VERIFIED | pypdf 1-28 전체 읽음. 도식 포함 별도 시각 검토. |
| [교안]인터넷보안_10.pdf | VERIFIED | pypdf 1-28 전체 읽음. 이미지 위주 쪽과 화면·프레임 구조 시각 검토. |
| [교안]인터넷보안_11.pdf | VERIFIED | pypdf 1-23 전체 읽음. 비교표와 마지막 공백 확인. |
| tmp/pdfs/internet-security-design-20261015 | PARTIAL | 기존 PNG·render-deps 목록 확인. 배정 주차 핵심 쪽을 새로 렌더해 확인. 타 주차 PNG는 선택하지 않음. |
| render-deps | PARTIAL | 제공된 pypdfium2를 렌더 의존성으로 사용. 패키지 전체 소스 리뷰는 과업 범위 아님. |
| dist/src/domain/content.js | VERIFIED | 제공된 개별 validator와 buildCatalog 구현 전체 읽음. 이 파일을 수정하지 않고 validateWeek만 사용. |

원문 교안 기준 디렉터리(학습 워크스페이스 상대 경로): `2026-2학기/인터넷보안/교안`.

임시 렌더 기준 디렉터리(학습 워크스페이스 상대 경로): `tmp/pdfs/internet-security-design-20261015`.

시각 확인 쪽은 9주차 9·15·23·25·26, 10주차 2·3·10·15·16·17·18·23·25·26·27, 11주차 9·23으로 총 18쪽이다. 접촉 시트로 구조와 사진을 확인한 뒤 9주차 23·26, 10주차 23, 11주차 9를 개별 고해상도 렌더로 재확인했다. LM의 일곱 문자 그림, 반환 정보 손상 그림, WEP의 공개 IV·KeyID/암호화 Data·ICV 경계, OWASP 비교표를 확인했다. 11주차 23쪽은 쪽번호와 빈 서식만 있는 공백으로 처리했다.

PDF 원본·교안 이미지·스크린샷은 dist에 복사하지 않았다. 원본과 타 작업자의 파일은 수정하지 않았다. 중간 렌더는 임시 디렉터리에만 존재한다.

## 학습목표 목록

9주차는 각 목표에 5문항을 연결했다.

- w09-recon: 정보 수집과 포트 반응의 증거 강도, 목록화·노출 축소.
- w09-sniff: 도청 피해, 전달 경로·암호화와 수신·해독 한계.
- w09-spoof: ARP·DNS·IP 신뢰 단서 위조와 흐름 제어 상태 조작.
- w09-dos: DoS/DDoS, 분산 역할, LAND·Ping of Death·SYN·Smurf, 자원 고갈.
- w09-ddos-defense: ACL·빈도·연결/요청 시간·최소 전송률·캐시·오탐·상위 병목.
- w09-system-boundary: 하드웨어·펌웨어·운영체제, 파일·메모리 보호, 네 가지 분리.
- w09-authentication: 식별·인증·인가, 지식·소유·생체와 위치 보조 신호.
- w09-accounts: passwd 필드·UID/GID·Windows 운영 역할과 정책 의존성.
- w09-password-storage: LM 역사, SAM/shadow 보호, 온라인/오프라인 추측, 현대 기준 한정.
- w09-persistence: 트로이 목마·백도어, 승인된 변경과 지속 접근 단서.
- w09-buffer: Text/Data/Heap/Stack, 쓰기 경계와 실제 실행 권한·완화의 한계.
- w09-format: 출력 규칙과 데이터 분리, 짧은 입력과 포맷 해석의 위험.

10주차는 각 목표에 5문항을 연결했다.

- w10-topology: 무선 기술 범주, Ad-Hoc/Infrastructure, AP·핫스팟·인터넷 경로.
- w10-threats: 도청·서비스 거부·비인가 AP, 역사 사건·카페라떼 조건.
- w10-discovery: Probe/Beacon, 탐색과 허가, 도보·차량·기호·지도 사례.
- w10-radio: 지향성·이득·불필요 방사, 구형 도구, 장치·채널·드라이버 한계.
- w10-mac-filter: 공개 식별자와 인증 증명, 중복/무작위화, BSSID·SSID 구분.
- w10-wep: 프레임·키 길이·IV·CRC·RC4/XOR·송수신 흐름·도구 역할과 보편 성공 수치 배제.
- w10-keys-wpa: 대칭/공개키 역할·상대 키 진정성, 구형 PSK와 현대 SAE의 구분.

11주차는 w11-owasp-context에 5문항, 나머지 목표에 4문항을 연결했다.

- w11-http-methods: HTTP 연결 세대·메소드 의미, POST의 암호화·크기·인가와의 구별.
- w11-url-status: URL·인코딩·조각, 응답 코드의 의미와 증거 한계.
- w11-web-boundaries: 정적/동적 웹·브라우저/서버/DBMS·서버 검증 책임·가상 위협 흐름.
- w11-owasp-context: 위험의 가능성·영향, 2013/교안 2017/공식 최종판, 이동 목적지 검증·탐지·대응.
- w11-injection: 질의·명령 구조와 데이터 분리, 매개변수·최소 권한·XXE 원리 구별.
- w11-session: 토큰 전달·갱신·만료·서버 무효화·민감 로그 최소화.
- w11-xss: 브라우저 출력 문맥·텍스트 표시·정화·보충 통제의 한계.
- w11-access: 객체/기능/동작별 서버 인가, UI 은닉·복잡한 식별자의 한계.
- w11-configuration-data: 기본 구성·오류 노출·배포 층·수집 최소화·암호화와 접근통제.
- w11-csrf: 자동 인증 정보와 의도, POST·HTTPS·SameSite의 범위와 토큰/출처 검증.
- w11-components-api: 구성요소 버전·배포·실행 권한·헤더 해석, API 형식과 서버 검증.

## 주요 근거와 정정 정책

37개 정정의 원문 쪽·문제·정확한 설명·채점 지침·확인한 1차 URL은 각 JSON의 corrections에 있다. 개별 출처는 해당 시점에 방문해 관련 설명을 확인했다. 접근 실패한 주소는 사용할 수 있는 주소로 교체하거나 근거 목록에서 제외했다.

- [Nmap 공식 스캔 해석](https://nmap.org/book/man-port-scanning-techniques.html): UDP/FIN 무응답, ACK의 필터 판정과 Window 방식 구별.
- [Microsoft LM 설명](https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/prevent-windows-store-lm-hash-password): 구형 LM을 현대 전체에 일반화하지 않음.
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): 현대 비밀번호 기준은 단독/다중요소의 적용 조건을 명시.
- [NIST SP 800-97 역사 자료](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=50897), [철회 상태](https://csrc.nist.gov/pubs/sp/800/97/final): WEP 구조 확인 전용. 2025-12-31 철회 사실 확인. 현재 운영 권고로 취급하지 않음.
- [Wireshark WLAN 문서](https://wiki.wireshark.org/CaptureSetup/WLAN): 채널·장치·드라이버와 수신 범위 확인.
- [HPE Aruba WPA3 문서](https://arubanetworking.hpe.com/techdocs/aos/wifi-design-deploy/security/modes/wpa3-personal/): SAE의 설계 목표를 구형 PSK 설명과 구별.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114.html), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html): POST, 201, 서버 오류, HTTP 세대, URI 문맥 정정.
- [OWASP 2017 최종판](https://owasp.github.io/www-project-top-ten/2017/Top_10.html): 교안의 최종판 번호와 실제 불일치 확인. 후보안의 정확한 원전 귀속은 추정으로 남김.
- OWASP 검증·인젝션·세션·인가·XSS·CSRF·암호 저장 치트시트: 외부 자료와 실행 규칙·권한 경계의 원리 및 통제 한계 확인.

## 결정 기록

| 맥락과 선택지 | 결정과 이유 | 영향 파일 | 후속 검토 |
| --- | --- | --- | --- |
| 구형 공격 명령을 그대로 수록하거나 방어 분석으로 재작성 | 원리·역할·가상 로그 판단만 수록. 공격 명령·실표적·페이로드 없이도 인과 관계를 설명 가능 | 세 week JSON, part-3.mjs | UI는 context를 텍스트로만 표시해야 함. 구현 담당이 확인 |
| 교안 오류를 정답으로 외우거나 정정과 시대를 나누기 | 1차 근거가 있는 설명을 채점 기준으로 삼고 교안 조건·역사·미확인 사실은 별도로 표시 | 세 week JSON | 실제 수업 평가의 출제 문구는 확인되지 않았으며 이 앱은 지원 자료 |
| 125를 맞추려 핵심 절을 합치거나 필요 문항을 추가 | 버퍼/포맷, 웹 취약점 각각의 독립 경계를 설명하며 140개 개별 문항 작성 | 세 week JSON, part-3.mjs | 다음 수정에서 문항 의미가 같아지면 family 통합 검토 |
| 최신 보충 내용을 교안 사실에 섞거나 분리 | NIST 비밀번호·WPA3-SAE·HTTP/3를 현대 보충으로 명시 | 세 week JSON | 학습자가 보충 범위를 공식 시험 예상으로 오해하지 않는지 UI에서 확인 |
| 타 작업자 목표를 추정해 선수 ID를 만들거나 독립 작성 | 모든 prerequisites는 빈 배열. 현재 세 파일의 목표만 연결하고 외부 추정 ID 없음 | 세 week JSON | 전체 통합 담당이 실제 선수 관계 검토 가능 |
| 불확실한 사건 수치·판본·시간을 채점하거나 유보 | 상세 근거가 부족한 사실은 채점에서 제외하고 제한을 정정 항목에 기록 | 세 week JSON | 신뢰할 원전이 추가되면 해당 사실만 재검토 가능 |

## 남은 사실 확인 한계

- 9주차 10쪽의 7.7·3.3 사건별 국가·서버·대상 수, 13쪽의 당시 인기·피해 최대 주장: 독립 검증하지 않아 수치·순위 채점 제외.
- 10주차 3쪽의 과거 이용 비중: 현재 비중을 확인하지 않음.
- 10주차 4-6쪽 국내 사건의 상세 사실, 피해자 수와 해외 보상액: 독립 확인 범위가 제한됨. 미 법무부 발표의 카드 번호 건수와 사람 수는 구별.
- 10주차 7쪽 카페라떼: 발견자 자료로 2007년 연구는 확인. 최초 공개 일자·행사와 고정 성공 시간은 확정하지 않음.
- 10주차 14·21쪽 구형 도구·카드의 현재 호환성, 26쪽 IV 수별 복구 보장: 검증하지 않으며 현재 설치 지침·성공 보증을 제공하지 않음.
- 11주차 1쪽 현재 HTTP 버전 점유율, 7-8쪽 세부 연도·최초 명칭: 채점 제외.
- 11주차 9-12쪽 교안의 정확한 OWASP 후보판 원전: 최종판 불일치는 확인했으나 후보판 귀속은 추정. 잘못된 최종 순위는 채점하지 않음.

최종 변경 경로는 `dist/content/week-09.json`, `dist/content/week-10.json`, `dist/content/week-11.json`, `tools/authoring/part-3.mjs`, 이 감사 문서의 다섯 개다.
