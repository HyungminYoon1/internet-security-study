# 파트 4 콘텐츠 감사

작성일: 2026-10-15. 담당 범위: 12·13·14주차 JSON, 이 감사 문서와 `tools/authoring/part-4.mjs`만.

## 완료 수량

| 주차 | 학습목표 | 독립 문항·family | 정정 | 원문 페이지 |
| --- | ---: | ---: | ---: | ---: |
| 12 | 11 | 55 | 12 | 19 |
| 13 | 10 | 50 | 10 | 19 |
| 14 | 9 | 45 | 11 | 18 |
| 합계 | 30 | 150 | 33 | 56 |

각 목표는 WHY, 원인·결과를 설명하는 두 문단 이상, 비교, 두 단계 이상 풀이 예, 오개념, 회상 질문을 갖는다. 각 문항은 고유하게 작성한 질문·네 보기·보기별 근거·하나의 정답을 갖는다. source MJS의 helper는 필드를 직렬화하고 보기 위치만 배분한다. 문항 변형·순열·공통 문장 템플릿을 추가 문항으로 생성하지 않는다. 앱 런타임에서는 정적 JSON만 사용한다.

## 입력 확인 상태

| 명시된 자료 | 상태 | 확인 범위 |
| --- | --- | --- |
| architecture.md | VERIFIED | 전문 완독. 콘텐츠·도메인·저장·UI 분리와 배포 제외 범위 확인 |
| docs/content-contract.md | VERIFIED | 전문 완독. 스키마·문항·커버리지·정정 상태 확인 |
| PDF skill | VERIFIED | 직접 전문 완독. pypdf 추출과 주요 페이지 이미지 확인 적용 |
| 교안 디렉토리 | PARTIAL | 13개 PDF 이름을 목록화하고 할당된 3개만 전문 추출. 다른 주차는 다른 담당 범위 |
| [교안]인터넷보안_12.pdf | VERIFIED | pypdf로 1~19쪽 전체 텍스트 완독, 6쪽 이미지 확인 |
| [교안]인터넷보안_13.pdf | VERIFIED | pypdf로 1~19쪽 전체 텍스트 완독, 3쪽 이미지 확인 |
| [교안]인터넷보안_14.pdf | VERIFIED | pypdf로 1~18쪽 전체 텍스트 완독, 5쪽 이미지 확인 |
| 임시 render-deps와 기존 PNG | PARTIAL | 임시 디렉토리 목록 확인, 지정 pypdfium2로 필요한 이미지 렌더. 의존성 패키지 소스는 검토 대상 아님 |
| dist/src/domain/content.js | VERIFIED | 당시 validateWeek와 buildCatalog 전체 소스 확인. 개별 주차 검증만 실행 |

PDF 공통 경로(앱 루트 기준 상대 경로): `../../2026-2학기/인터넷보안/교안`.

렌더 경로(앱 루트 기준 상대 경로): `../../tmp/pdfs/internet-security-design-20261015`. 이미지는 앱·dist에 복사하지 않았다. 원본 PDF도 복사하지 않았다. 전체 텍스트 완독과 모든 페이지의 시각적 검토는 구분한다. 시각 확인은 다음 주요 14쪽이다.

- 12주차 11·14·15·17·18·19쪽: 인증 도구·목록, IIS 업로드·이동·웹쉘 화면, 대량 변조 로그·도구, 빈 페이지.
- 13주차 13·15·19쪽: DB/DDoS 상관 표, SMTP·NAC 시나리오, 빈 페이지.
- 14주차 10·11·12·15·17쪽: 연결·어댑터 검사 실패, IceSword·프로세스 화면, 이벤트 표, ctime·계정·특수 권한 페이지.

각 JSON의 coverage는 한 페이지씩 56개 항목으로 구성했다. 12주차 19쪽과 13주차 19쪽은 빈 서식·쪽번호뿐임을 이미지로 확인하여 blank와 이유를 명시했다. 나머지 54쪽은 covered 또는 historical이며 모두 학습목표에 연결했다. 1쪽의 목표·진단문제는 같은 쪽의 실제 교수 내용과 함께 대응했다. 학습정리 페이지도 관련 목표에 연결했다. 이미지에만 나타나는 도구 조작은 현재 실행 지침으로 재현하지 않았다.

## 목표별 문항 수와 교수 범위

| 목표 ID | 문항 수 | 범위 |
| --- | ---: | --- |
| w12-sql-boundary | 6 | DML·DDL, 쿼리 구조·값, 로그인 조건, 바인딩·식별자 |
| w12-sql-evidence | 5 | 오류·500·UNION·메타데이터·진단 노출 |
| w12-sql-privilege | 4 | 저장 프로시저·DB/OS 권한·xp_cmdshell |
| w12-mass-chain | 4 | DB 대량 오염→출력 실행·인코딩·복구 범위 |
| w12-xss-context | 6 | 저장·반사·DOM·문맥별 출력·정화·구형 브라우저 |
| w12-cookie-session | 5 | 쿠키·세션·속성·재사용·클라이언트 역할 조작 |
| w12-credential-risk | 4 | 기본 자격·추측·시간 단정·다중요소·시도 통제 |
| w12-exposed-files | 5 | 목록·추측·백업·직접 파일 공개 |
| w12-object-authorization | 5 | 인증/인가·객체/행위·정상 형식·난수 ID |
| w12-download-boundary | 5 | 저장 경계·파일 ID·계정 파일·OS 읽기 권한 |
| w12-upload-delivery | 6 | 형식·내용·MIME·저장/실행·이름 변경·숨김 참조 |
| w13-esm-foundation | 5 | 통합 배경·관리/관제/운영/공유·예방·공조 |
| w13-control-sources | 5 | 자체보호·기능·NAC/DRM/DLP·정보원·에이전트 |
| w13-log-evidence | 5 | 수집/보관·정규화·시각대·수집 장애·증거 한계 |
| w13-network-patterns | 5 | 연결 정책·분포·승인 스캔·웜/바이러스·포트 |
| w13-ids-patterns | 5 | 탐지/차단/성공·로그인·FrontPage/IRC·중복 |
| w13-cross-device | 5 | DB/DDoS/봇·상관 키·주소 공유·영향·위험도 |
| w13-rule-design | 5 | SMTP 결합 조건·이상/초과·고정/이동 창·튜닝 |
| w13-insider-signals | 5 | NAC 삭제·공유·매체·보유·공휴일·직원 속성 |
| w13-exfil-chain | 5 | 조회→메일/매체·암호화 해제·동일 주체/자료 |
| w13-table-conditions | 5 | Non-웜/웜·다중 포트·DB·DDoS 1/2 계산 |
| w14-incident-team | 5 | 유형·영향·CERT 예방·역할·연락·기획/관제 |
| w14-response-stages | 5 | 예방→탐지→초동→전략→조사→보고→재발 방지 |
| w14-contain-recover | 5 | 다섯 유형의 대응·격리·증거·원인 제거·복구 |
| w14-alert-support | 5 | 교안 경보 단계·원격/현장·지원 범위 |
| w14-windows-live | 5 | 초기 점검·연결·프로세스·루트킷·도구 실패 |
| w14-windows-persistence | 5 | 레지스트리·자동 실행·사용 흔적·기준선 |
| w14-windows-events-web | 5 | 구형 이벤트·현대 4625·IIS·웹 로그·패턴 한계 |
| w14-linux-live-account | 5 | 구성·휘발성·프로세스/연결·계정·접속·로그 |
| w14-linux-time-integrity | 5 | ctime/mtime/btime·특수 권한·숨김 파일·해시·NSRL |

## 정정과 근거

정확한 페이지・원문 문제・올바른 설명・시험 학습 지침・방문한 primary URL은 JSON corrections에 항목별 저장했다. verified는 직접적인 기술적 정정, contextualized는 버전·조건·추론 한계 보충, excluded는 검증되지 않은 주장의 점수화 제외를 의미한다. 근거 문서가 미확인 역사 주장 자체를 입증한다고 표현하지 않았다.

- 12주차: 2~3쪽 SQL 경계·오류 단정; 3쪽 GROUP BY 없는 HAVING 단정; 4~5쪽 카탈로그·버전; 5~6·18쪽 xp_cmdshell 권한; 6~7·17~18쪽 대량 오염; 7~9·15~16쪽 XSS 문맥·구형 기능; 7·9~10쪽 쿠키; 10~11쪽 해독 시간; 11~12쪽 공개 파일; 12~13쪽 객체 인가; 13쪽 passwd/shadow; 13~16쪽 업로드 실행; 18쪽 도구 연혁 제외.
- 13주차: 2·4쪽 인력·중요도; 3~5쪽 제품 보장 범위; 6~7쪽 로그 완전성; 8쪽 바이러스 복제 정정; 7~15쪽 경보/침해 및 임계값; 11~12쪽 구형 시그니처; 9~15쪽 조건·집계; 15~18쪽 내부 행위와 실제 유출; 13쪽 UDP 1433 표기; 7~8쪽 방화벽 경로·행위자 추론.
- 14주차: 1~4쪽 교육 분류와 현재 법적 판단 구분; 2쪽 기관 연혁 제외; 3~9쪽 보존/격리/복구; 5~6쪽 경보 시점; 9~12·18쪽 도구와 FileMon 정정; 13~15쪽 경로·흔적; 15쪽 이벤트 버전; 17쪽 ctime; 17~18쪽 계정·접속·셸 기록; 9·17~18쪽 참조 해시·NSRL; 15~16쪽 웹 패턴 검색.

주요 primary 문서:

- [OWASP SQL 주입 방어](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [XSS 방어](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [세션 관리](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [파일 업로드](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [인증](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [인가](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [Microsoft HAVING](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-having-transact-sql?view=sql-server-ver17), [xp_cmdshell](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/xp-cmdshell-transact-sql?view=sql-server-ver17), [SQL Server Browser](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-browser-service-database-engine-and-ssas?view=sql-server-ver17).
- [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265), [Apache mod_autoindex](https://httpd.apache.org/docs/2.4/mod/mod_autoindex.html).
- [NIST 바이러스 정의](https://csrc.nist.gov/glossary/term/virus), [SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final), [SP 800-41r1](https://csrc.nist.gov/pubs/sp/800/41/r1/final), [FIRST CSIRT 서비스](https://www.first.org/standards/frameworks/csirts/csirt_services_framework_v2.1).
- [NIST SP 800-61r3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), [SP 800-86](https://csrc.nist.gov/pubs/sp/800/86/final). 후자는 실제 PDF의 휘발성 자료·수집 위험·시스템 상태 변화 설명을 확인했다. [원문 PDF](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-86.pdf)의 PDF 27·52~55쪽을 검색으로 확인했다.
- [Windows 감사 이벤트 비교](https://github.com/MicrosoftDocs/windowsserverdocs/blob/main/WindowsServerDocs/identity/ad-ds/plan/Appendix-L--Events-to-Monitor.md), [4625](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4625), [Process Monitor](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon), [Process Explorer](https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer), [Autoruns](https://learn.microsoft.com/en-us/sysinternals/downloads/autoruns).
- [inode(7)](https://man7.org/linux/man-pages/man7/inode.7.html), [passwd(5)](https://man7.org/linux/man-pages/man5/passwd.5.html), [shadow(5)](https://man7.org/linux/man-pages/man5/shadow.5.html), [NIST NSRL](https://www.nist.gov/itl/csd/secure-systems-and-applications/national-software-reference-library-nsrl). NSRL 등재는 무해성 보증이 아니다.

CISA 격리·전원 지침은 검색 결과의 공식 발췌를 참고했지만 직접 페이지·PDF 열기가 실패하여 배포 콘텐츠의 정정 근거에는 사용하지 않았다. 증거 보존 판단은 접근 가능한 NIST 원문으로 검증했다. GNU findutils 원문의 직접 접근 실패 시에는 접근 가능한 Linux man-pages의 inode 시간 정의로 ctime을 검증했다.

## 결정 기록

| 맥락·고려한 선택 | 결정과 이유 | 영향 파일·후속 검토 |
| --- | --- | --- |
| 교안 예시 문자열 복사 vs 원리 설명 | 작동 payload·실제 대상·도구 실행 예시를 배제하고 가상 상황과 원리로 재서술. 학습 목적과 정적 앱 범위를 유지 | 세 JSON. 공격 실행이나 live API 검증은 하지 않음 |
| 오래된 설명을 정답화 vs 현대 설명으로 모두 치환 vs 이중 문맥 | 교안 범위와 현대 보충을 명시하고 확인된 오류는 수정. 역사·미확인 항목은 별도 상태 표시 | corrections와 historical coverage. 현재 법률·기관 연혁으로 확대 해석 금지 |
| 탐지표 숫자 암기 vs 계산 가능한 상황 | 표의 수치를 조건으로 명시한 5문항을 추가하여 13주차를 50문항으로 확대. 상관 키·AND·분포·경계 이해를 평가 | week-13.json. 보편 침해 임계값으로 사용하지 않음 |
| 전원 일괄 차단 vs 무조건 가동 vs 상황 평가 | 안전·확산·업무·휘발성 증거를 평가한 격리·수집·기록·복구 | week-14.json. 실제 사고 지휘 절차와 숙련된 수집을 대신하지 않음 |
| 다른 작업자의 선수 목표 추정 vs 독립 콘텐츠 | prerequisites는 빈 배열. 아직 확정되지 않은 다른 주차 ID를 만들지 않음 | 세 JSON. 통합 후 부모가 실제 교육 흐름에 맞춰 연결 가능 |
| 런타임 문항 생성 vs 명시 저작 데이터 | 150개 독립 문항을 source MJS에 명시. helper는 스키마 직렬화와 한 문항의 보기 배치만 수행 | part-4.mjs와 세 JSON. 실행 명령: node tools/authoring/part-4.mjs |

## 검증 결과와 한계

- `node tools/authoring/part-4.mjs`: 세 주차 `validateWeek()` PASS. 목표당 최소 3문항과 family 중복도 별도 확인.
- JSON을 다시 읽어 개별 `validateWeek()`를 실행. 스키마·정확한 원문 이름/쪽수·ID·보기·정답 연결·목표·정정·URL·페이지 커버리지 확인.
- 150문항, 30목표, 33정정. 전체 문항 ID·family·질문 문장 중복 없음. 각 문항은 네 개의 서로 다른 보기와 하나의 answerId 보유.
- 목표별 문항 수는 최소 4, 최대 6. 해설·풀이·회상 질문의 길이 및 개수는 부모 검증기를 통과했다.
- 모든 텍스트 파일은 UTF-8 BOM 없음·CRLF로 정규화하고 저장 바이트를 검사했다.
- 브라우저 UI·앱 통합·모의고사 전체 로직·CI는 담당 범위 밖이며 이 감사에서 실행 완료를 주장하지 않는다. `buildCatalog()`는 모든 13주차가 필요한 통합 작업이므로 실행하지 않았다.

미해결 사실: 12주차 18쪽의 공격 도구 국가·연도 귀속과 14주차 2쪽의 기관 연혁을 독립 확정하지 못했다. 각각 excluded로 표시하여 점수 문항에서 제외했다. 구형 도구의 현재 호환성·과거 외부 사이트의 현재 안전성·국가 경보 및 법률의 현행 효력도 이 작업이 보증하지 않으며 문항에서 단정하지 않는다. 원문 원인 분석·현대 방어 개념의 남은 검증 장애는 없다.
