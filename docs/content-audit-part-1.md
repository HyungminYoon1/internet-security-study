# 콘텐츠 감사 PART 1: 1–4주차

작성·검증일: 2026-10-15. 이 문서는 콘텐츠 작성 범위의 감사 기록이며 앱 UI, 전체 카탈로그 통합, CI, 배포 완료를 의미하지 않는다.

## 결과

| 주차 | 목표 수 | 문항 수 | 독립 family 수 | 정정 기록 | PDF 페이지 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 7 | 35 | 35 | 6 | 15 |
| 2 | 13 | 65 | 65 | 14 | 27 |
| 3 | 15 | 50 | 50 | 13 | 34 |
| 4 | 8 | 40 | 40 | 9 | 21 |
| 합계 | 43 | 190 | 190 | 42 | 97 |

정정 상태: verified 25, contextualized 15, excluded 2. contextualized 기록 안에서도 적용 조건이 불명확한 용량·최초 연대·현재 자격 등 일부 주장은 명시적으로 채점 제외했다. 기록 수는 오류 개수나 공식 정오표 발행 수가 아니다.

모든 학습목표에 독립적으로 작성한 문항 3개 이상이 연결된다. 모든 문항은 고유 문항 ID, 의미별 family, 네 개의 서로 다른 보기, 보기별 이유, 단일 정답, 해설, 교안 페이지를 갖는다. 전체 정답 위치는 a=49, b=48, c=47, d=46이다. 보기 위치만 바꾼 중복 문항이나 런타임 생성 문항은 없다.

## 명시된 자료의 확인 상태

| 자료 | 상태 | 확인 범위와 한계 |
| --- | --- | --- |
| architecture.md | VERIFIED | 작업 전에 전체 읽음. 콘텐츠만 작성하고 도메인·UI·저장소·배포 계층은 수정하지 않음. |
| docs/content-contract.md | VERIFIED | 작업 전에 전체 읽음. 필드·ID·범위·정정·문항 요건 반영. |
| 사용자가 지정한 로컬 PDF 스킬의 SKILL.md | VERIFIED | 직접 전체 읽음. pypdf 추출과 그림 렌더링 병행. 스킬은 공개 앱에 포함하지 않음. |
| 지정 교안 디렉터리 | PARTIAL | 파일 전체 목록 확인 후 담당 01–04 PDF만 선택. 05–07·09–14는 다른 작성자 범위여서 본 작업에서 읽지 않음. |
| [교안]인터넷보안_01.pdf | VERIFIED | 1–15쪽 전체 pypdf 텍스트 읽기, 9·14쪽 그림 확인. |
| [교안]인터넷보안_02.pdf | VERIFIED | 1–27쪽 전체 pypdf 텍스트 읽기, 5·16·22쪽 그림 확인. |
| [교안]인터넷보안_03.pdf | VERIFIED | 1–34쪽 전체 pypdf 텍스트 읽기, 2·20·21쪽 그림 확인. 출력이 잘린 24–30쪽은 별도 추출로 완독. |
| [교안]인터넷보안_04.pdf | VERIFIED | 1–21쪽 전체 pypdf 텍스트 읽기, 3·7·8·10·14·15·16·19쪽 그림 확인. |
| 지정 render-deps 및 기존 PNG 디렉터리 | PARTIAL | 렌더러 의존성 사용. 기존 week02-page16/22, week03-page02/21 PNG 직접 확인. 타 주차 PNG는 범위 밖. |
| dist/src/domain/content.js | VERIFIED | 부모가 제공한 개별 validateWeek 구현 전체 읽고 가져와 실행. 수정하지 않음. |
| 주요 외부 1차 출처 | PARTIAL | 정정 주장에 필요한 공식 페이지·명세 해당 부분을 확인. 모든 RFC 전체를 완독한 것은 아니며 현재 운영 제품의 실제 상태를 검사하지 않음. |

PDF 텍스트의 첫 출력은 Python 콘솔 인코딩 때문에 깨져 표시되었다. 파일을 추측 편집하지 않고 PYTHONIOENCODING=utf-8로 다시 추출하여 한글 원문을 읽었다. PDF 원본은 변경하지 않았다.

시각 확인은 선택된 핵심 도표 16페이지이며 모든 페이지를 렌더링했다는 뜻이 아니다. 3주차 21쪽은 텍스트 추출이 거의 없지만 디렉터리 표가 있는 교육 페이지이므로 blank로 제외하지 않았다. 각 JSON coverage는 정확히 각 페이지를 한 번씩 포함한다. 1주차 2쪽은 평가·교재 안내로 administrative, 1쪽은 행정 소개와 사전 문제의 혼합으로 해당 교육목표에 연결했다. 담당 자료에 완전히 빈 페이지로 분류한 페이지는 없다.

검토용 contact sheet는 앱 바깥의 지정 임시 디렉터리에 part1-week01-review.png부터 part1-week04-review.png까지 생성했다. PDF나 교안 이미지·스크린샷을 앱/dist에 넣지 않았다.

## 학습목표와 소단원 범위

- w01: internet, threat, cia, osi, transport, network, address. 인터넷/웹·ARPANET, 고의/실수·차단/도청/변조/위조, 과거 통계의 한계, 위험 요인·CIA, 일곱 계층과 전송 단위, TCP/UDP·윈도/MTU/ACK, LAN/MAN/WAN·응용서비스, 주소 위임·DNS·도메인 자격 표의 적용 한계를 다룬다.
- w02: classical, history, keys, services, design, des, aes, publickey, hash, signature, hybrid, lifecycle, pki. 정보 생명주기와 물리/환경 위험부터 스테가노그래피·대입/전치/이동/아핀, 기계/근대/현대 역사, 키 관계·키 수 공식, 보안 서비스, 혼동/확산·계산 비용, 블록/스트림 분류·DES/3DES/DESX/IDEA/AES·운영 모드·패딩, RSA/DH/ECC/DSS, 이미지 분류 오류, 해시·생일 효과, 서명·재전송 한계, 봉투, 키 수명과 역사적 위탁, 인증서·CA/RA/CPS/CRL까지 다룬다.
- w03: hardware, os, winfs, winboot, accounts, sharing, winservice, updates, unixfiles, linuxboot, privileged, path, permissions, networkcontrol, oldservices. 하드웨어/펌웨어/소프트웨어·구성도, OS 관리·분리, FAT/NTFS, 옛 Windows 부팅, 관리자/Guest/계정 종료/잠금, 공유/관리 공유/NetBIOS, 불필요 서비스와 IIS 샘플·관리 기능, 패치/백신, 파일 종류와 트리·디렉터리 표, 옛 Linux 부팅/실행수준, root/비밀번호, PATH, passwd/shadow/services·비트 권한, Wrapper/플랫폼별 접속 제한, 익명 FTP·r 계열 및 상충 설정을 다룬다.
- w04: vpn, functions, deployment, ipsec, ahesp, ike, vpncrypto, tlsvpn. 사설/공중망·전용선·L2/MPLS·품질, 암호/인증/무결성/터널/압축, 분류 축·본지사/협력사/이동 사용자, SPD/SAD/SA·IPv6·재전송, AH/ESP와 전송/터널 범위, IKEv1/확장/IKEv2·DH·장비/사용자·주소/정책·수명, DES 제원·MAC, SSL 역사/TLS·포털/전체 터널·포트/설치/단말/인가 비교를 다룬다.

위 접미사는 각 주차 접두사와 결합한 실제 ID다. 예: w01-internet, w02-signature, w03-networkcontrol, w04-ahesp. 선수목표는 모두 []로 두어 다른 작업자의 ID에 의존하지 않는다.

## 주요 정정과 근거

완전한 issue/corrected/examGuidance/status/reference URL 및 정확한 페이지는 각 week JSON의 corrections에 기록했다. 아래는 검토 우선 항목이다.

| 교안 위치 | 처리 | 확인한 1차 출처 |
| --- | --- | --- |
| w01 p3 | ARPANET 1996 → 1969 | [DARPA](https://www.darpa.mil/about/innovation-timeline/arpanet) |
| w01 p9–11 | 계층 참조모형·프레임/패킷, TCP 체크섬/윈도/ACK 한계 | [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) |
| w02 p7 | 이동암호 예시를 명시적 나머지 연산으로 재계산 | [UCF 원저작 수업 자료](https://www.cs.ucf.edu/courses/cis3362/fall2024/quiz/Q1-Sol.pdf) |
| w02 p8 | Colossus는 Lorenz 해독 지원 장치 | [제작·복원 박물관](https://www.tnmoc.org/colossus) |
| w02 p16 | McEliece 부호 기반, NTRU 격자 관련 계열 | [McEliece 저자 자료](https://classic.mceliece.org/), [NTRU 원논문](https://www.ntru.org/f/hps98.pdf) |
| w02 p17–18 | AES 블록 128·키 128/192/256·10/12/14라운드, 선정 2000/표준 2001 | [FIPS 197](https://csrc.nist.gov/pubs/fips/197/final) |
| w02 p17–18, w04 p16 | DES 16라운드·64비트 블록·56 유효 키, 9회 오류·2005 철회 | [FIPS 46-3](https://csrc.nist.gov/pubs/fips/46-3/final), [원명세](https://csrc.nist.gov/files/pubs/fips/46-3/final/docs/fips46-3.pdf) |
| w02 p22 | 서명자 개인키로 생성·서명자 공개키로 검증, 재전송·기밀성 별도 | [FIPS 186-5](https://csrc.nist.gov/pubs/fips/186-5/final) |
| w02 p13/21/23, w04 p4/17 | MAC·인증된 암호화와 키 없는 해시 구분 | [RFC 2104](https://www.rfc-editor.org/rfc/rfc2104), [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) |
| w02 p26 | CPS는 Certification Practice Statement | [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html) |
| w03 p1/33 | 펌웨어 비휘발성과 업데이트 가능성 분리 | [NIST SP 800-193](https://csrc.nist.gov/pubs/sp/800/193/final) |
| w03 p5–6 | 파일시스템 기능·백업 및 Windows 부팅 세대 구분 | [Microsoft 파일시스템](https://learn.microsoft.com/en-us/windows/win32/fileio/filesystem-functionality-comparison), [Windows 부팅](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting) |
| w03 p11–17 | Everyone와 익명, 관리 공유 의존성, 구형 IIS·SMB 범위 | [Microsoft 익명 정책](https://learn.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/network-access-let-everyone-permissions-apply-to-anonymous-users), [IIS 공식 보안 구성](https://learn.microsoft.com/en-us/iis/configuration/system.webServer/security/) |
| w03 p22–23 | LILO/SysV/inittab/runlevel을 버전·배포판 한정 | [systemd 프로젝트 FAQ](https://systemd.io/FAQ/) |
| w03 p24–25 | PAM login과 SSH 정책 분리, 과거 조합·주기 기준과 현재 인증 구분 | [OpenSSH sshd_config](https://man.openbsd.org/sshd_config), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) |
| w03 p26–30 | PATH 이동/제거 충돌, 비트 권한, passwd/shadow/services, Wrapper 지원 | [GNU Bash](https://www.gnu.org/software/bash/manual/bashref.html), [OpenSSH 6.7 지원 제거](https://www.openssh.org/txt/release-6.7), Linux man-pages 원저작 매뉴얼(각 JSON 참조) |
| w04 p9–12 | SPD/SAD·단방향 SA, IPv6 자동 보호 아님 | [RFC 4301](https://www.rfc-editor.org/rfc/rfc4301), [RFC 8504](https://www.rfc-editor.org/rfc/rfc8504) |
| w04 p10–11 | AH 암호화 없음·변경 필드 예외, ESP 서비스 선택·외부 헤더 한계 | [RFC 4302](https://www.rfc-editor.org/rfc/rfc4302), [RFC 4303](https://www.rfc-editor.org/rfc/rfc4303) |
| w04 p13–15 | IKEv1/확장과 IKEv2 분리·DH 비밀 계산 | [RFC 7296](https://www.rfc-editor.org/rfc/rfc7296), [RFC 9395](https://www.rfc-editor.org/rfc/rfc9395) |
| w04 p18–21 | SSL 폐기와 TLS, 브라우저 포털/전체 터널·끝점·인가 범위 | [RFC 7568](https://www.rfc-editor.org/rfc/rfc7568), [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446), [역사적 NIST VPN 구조](https://csrc.nist.gov/pubs/sp/800/113/final) |

일부 공식 사이트의 최초 요청이 실패하여 대체 공식 경로나 원저작 자료를 열었다. GNU Bash의 PATH 문구는 공식 검색 결과 본문에서 확인했고 직접 페이지 요청은 반복 실패했다. McEliece 소개도 공식 검색 결과로 확인했으며 NTRU 원논문에서도 부호 기반 McEliece와 격자 관련 NTRU를 확인했다. 확인되지 않은 최신 제품 운영 결과를 확인된 것으로 기록하지 않았다.

## 미해결·채점 제외 사항

- w01 p5의 1978·1990년 해독률 및 1997년 침투/발견/보고 수치 원연구·표본은 독립 확인하지 못했다. 수치 문항은 없다. 정정에 연결한 현재 NIST 인증 문서는 과거 통계의 입증 출처가 아니라 현대 비교 자료임을 명시했다.
- w02 p4/9/10의 고대 정확한 연대·인물별 해독 귀속·Shannon의 해시 제안·포괄적 최초 표현은 채점에서 제외했다. 박물관과 표준 문서는 제외한 모든 역사 주장에 대한 입증 자료가 아니다.
- w02 p15 clustering의 불명확한 문구는 용어 정답으로 사용하지 않았다. p24 ESS는 역사적 위탁 사례이며 현재 모든 키에 대한 분할·기관 위탁 지침으로 바꾸지 않았다.
- w01 p14의 실제 학교 이름/주소 대응과 현재 도메인 등록 자격은 실시간 검증하지 않았다. DNS·주소 위임의 기능과 표의 시대적 한계만 설명했다.
- w03 p5의 FAT 계열 수치 한계는 구현·도구 조건이 불명확하여 단일 정답 수치로 사용하지 않았다. AIX/HP-UX/Sun 및 구형 IIS 절차는 실행 검증하지 않은 역사 사례다.
- w04의 최초 VPN·인터넷 지연 절대 보장·무조건 무설치/관리자 불필요/타인 기기 안전 같은 표현은 채점 사실로 사용하지 않았다.
- 실제 중간고사의 문제 수·유형·배점은 본 작업으로 확인하지 않았다. 작성 문항 수는 학습 지원 목표이며 시험 예측이 아니다.

## 콘텐츠 결정 기록

1. 역사와 현재 권고의 충돌: 원문을 무비판 재현하거나 교안 내용을 전부 현대 설정으로 치환하는 선택지를 검토했다. 최종적으로 버전·역사 맥락을 유지하고 오류는 corrections와 연결했다. 이유는 시험 학습 범위를 유지하면서 틀린 주장을 정답으로 학습시키지 않기 위해서다. 영향 파일은 담당 네 JSON과 part-1.mjs다. 후속 검토는 담당 교수의 공식 정오표가 생길 경우 해당 기록을 대조하는 것이다.
2. 운영 명령과 위험한 예시: 원문 명령 복사와 판단 중심 재설명 중 후자를 선택했다. 실제 계정 삭제·레지스트리·접속 정책 변경·공격 실행을 넣지 않고 가상 상태·규칙 해석을 사용했다. 이유는 환경과 지원 버전이 확인되지 않은 학습 앱에서 실행 결과를 보장할 수 없기 때문이다. 영향 파일은 담당 네 JSON이다. 실제 운영 적용은 별도 승인·버전 문서·검증 과제다.
3. 범위와 분량: 수량을 맞추기 위한 변형 생성 대신 각 소단원의 원인·비교·사례·오해를 명시적으로 작성했다. 계정·서비스·권한·파일 종류가 많은 3주차는 45 목표보다 많은 50문항이 필요하다고 판단했다. 나머지는 35/65/40이다. 영향 파일은 part-1.mjs와 week-03.json을 포함한 담당 JSON이다. 후속 검토는 UI에서 과도한 부담 없이 목표별로 나눠 학습되는지 확인하는 것이다.
4. 생성 경로: 직접 거대 JSON 편집과 명시적 원고 MJS 직렬화 중 후자를 선택했다. 각 q 호출은 고유한 수작업 문항 한 개이며 헬퍼는 스키마 변환과 보기 위치 배치만 수행한다. 새 문항·설명을 템플릿으로 증식시키지 않는다. 생성기는 담당 01–04 파일만 쓴다. 수정은 원고에서 하고 재생성해야 한다.
5. 공유 작업 범위: 다른 작성자의 콘텐츠·UI·도메인·테스트를 수정하지 않았다. 개별 validateWeek와 담당 파일에 대한 추가 무결성 검증만 완료 상태로 기록한다. 저장·접근통제·아키텍처·데이터 보관 정책 변경은 없다.

## 검증 결과와 재현

실행: `node tools/authoring/part-1.mjs`

- PASS: 부모의 validateWeek()로 01–04 네 파일 개별 검증.
- PASS: 목표별 문항 3개 이상, 각 주차 ID·family·문항 중복 없음, 정규화한 190개 문제문 중복 없음.
- PASS: 네 보기의 고유성·정답 ID·보기별 이유·출처 페이지·정정 ID 및 HTTPS 출처.
- PASS: 목표 본문 2문단 이상·비교 2개 이상·풀이 2단계 이상·회상 확인·오개념 설명.
- PASS: 담당 97페이지가 누락·중복 없이 coverage에 한 번씩 연결됨. 문항 출처 페이지가 연결 목표의 페이지 목록에 포함됨.
- PASS: 새 텍스트 6개 파일의 UTF-8 무BOM·CRLF·유니코드 대체문자 없음 확인.
- NOT_RUN: 전체 13주차 buildCatalog 통합 검증·앱 UI·브라우저·CI·배포 검증. 본 작업자는 이를 담당하지 않는다.
- NOT_RUN: 실제 OS·IIS·SSH·VPN 설정 변경이나 외부 대상 통신·공격 실험.

내용 검증은 단일 정답의 의미를 수학적으로 증명하는 자동 검사가 아니다. 각 문항의 정답과 오답 이유는 원고 작성 중 수동 검토했고 구조 검증과 구분한다.

## 변경 파일

담당 앱 콘텐츠: dist/content/week-01.json, dist/content/week-02.json, dist/content/week-03.json, dist/content/week-04.json.

담당 원고·감사: tools/authoring/part-1.mjs, docs/content-audit-part-1.md.

이 여섯 파일 외의 앱 파일·Git 설정을 변경하지 않았으며 커밋·푸시·게시·다른 에이전트 실행을 하지 않았다.
