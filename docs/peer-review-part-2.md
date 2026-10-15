# Part 2 독립 의미 검토

검토일: 2026-10-15. `week-05.json` 48문항·15목표·11정정, `week-06.json` 50문항·12목표·10정정, `week-07.json` 53문항·14목표·16정정을 전부 읽었다. `docs/content-audit-part-2.md`도 전체 대조했다.

## 수정 전 발견 사항

정답을 뒤집어야 할 확인된 오류나 복수 정답은 발견하지 못했다. 아래는 별도의 평가 품질·학습 범위 문제다.

| 우선순위 | 관련 문항·목표 | 확인한 문제와 권고 |
| --- | --- | --- |
| P2 | 예: w05-q002/q021/q043, w06-q021/q024/q030/q047, w07-q005/q013/q028/q049 | 저장장치 손상·물리 용량·암호문 길이 0·사람의 기억·제품 외형/이름 등 문맥 밖 선택지가 반복된다. 정답 오류는 아니지만 배운 개념 없이 제거할 수 있어 실제 이해를 평가하기 어렵다. 해당 개념의 인접 개념 혼동·전제 누락·불충분한 증거로 교체해야 한다. 다른 문항도 전수 점검 대상이다. |
| P3 | w07-q007/q018/q024 및 w07-hids-nids·response; 교안 p12 | coverage는 IDS 로그의 프라이버시를 포함했다고 하지만 해당 목표는 기록 변조·누락·대응 영향 위주다. 수집한 요청·식별정보 자체의 노출, 수집 최소화·권한·보존을 IDS 맥락에서 설명하고 회상 확인에 연결하면 범위 주장이 더 정확해진다. 5주차의 일반 감사 설명만으로 7주차 단독 학습의 연결이 자동 확보되지는 않는다. |
| P3 | w07-q039/q040 및 w07-snort-options; 교안 p17 | `established`는 설명·평가하지만 같은 원문 표의 `stateless` 의미가 빠져 있다. 연결 상태와 관계없이 평가한다는 뜻이며 상태를 잃은 오류 상태·공격 판정·무조건 허용과 다름을 비교해야 한다. [Snort 공식 flow 설명](https://docs.snort.org/rules/options/non_payload/flow). |

## 출처·범위 확인

담당 교안 83쪽(5주 28, 6주 24, 7주 31)을 pypdf로 읽고 coverage와 대조했다. 누락·중복 페이지 및 문항의 출처 페이지와 coverage 목표 연결 오류는 없었다. 6주차 p24는 쪽 번호뿐인 blank 처리가 맞다. 기존 렌더 16쪽(5주 6/25/26/27, 6주 9/10/21/22/24, 7주 4/8/14/15/23/27/28)을 직접 확인했다. 전체 페이지의 시각 검토를 뜻하지 않는다.

1차 출처로 Snort의 [검색 범위](https://docs.snort.org/rules/options/payload/oddw), [동작](https://docs.snort.org/rules/headers/actions), [방향](https://docs.snort.org/rules/headers/directions), [flow](https://docs.snort.org/rules/options/non_payload/flow), [sid](https://docs.snort.org/rules/options/general/sid), [URI 버퍼](https://docs.snort.org/rules/options/payload/http/uri), [IP 조건](https://docs.snort.org/rules/headers/ips)을 확인했다. w07-q037의 offset 2·depth 4에서 SAFE라는 정답은 공식 의미와 맞는다. w06-q025~q028의 최초 일치·AND 조건, w07-q021/q022의 15/20·15/23 계산도 맞다.

Oracle 19c의 [감사 파라미터](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/AUDIT_TRAIL.html), [OS 감사 위치](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/AUDIT_FILE_DEST.html), [OS 인증](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/configuring-authentication.html), [TDE](https://docs.oracle.com/en/database/oracle/oracle-database/19/asoag/introduction-to-transparent-data-encryption.html) 및 MySQL 8.4의 [검증 컴포넌트](https://dev.mysql.com/doc/refman/8.4/en/validate-password.html), [Enterprise Audit](https://dev.mysql.com/doc/refman/8.4/en/audit-log.html)을 대조했다. 관련 정정에서 확인된 반대 주장은 없었다. [NIST 방화벽 지침](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-41r1.pdf)과 [IDPS 지침](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-94.pdf)은 관련 기능 범위의 비교에 사용했다.

미확인 내부자 비율 90/70/75%는 계속 excluded로 유지해야 한다. 모든 외부 명세 전체·제품별 실제 동작·법적 기준·공식 시험 채점은 검증하지 않았다. 구조 검증의 통과를 의미 정확성의 자동 증명으로 보지 않는다.

## 후속 수정 권한과 처리 상태

사용자의 추가 승인에 따라 Part 2 원고·세 JSON 및 전용 회귀 테스트를 수정했다. 원저자 감사 문서와 구현 파일은 수정하지 않았다.

## 검토자 해결 기록

| 주차 | 수정 문항 | 교체한 오답 선택지 | 유지한 전체 문항·목표·정정 |
| --- | ---: | ---: | --- |
| 5 | 37 | 66 | 48·15·11 |
| 6 | 38 | 76 | 50·12·10 |
| 7 | 34 | 70 | 53·14·16 |
| 합계 | 109 | 212 | 151·41·37 |

P2는 151문항 전체 선택지를 재검토하여 무관한 기능·엉뚱한 명칭·자명한 결과 대신 인접 개념 혼동, 적용 범위 오해, 불충분한 근거를 묻도록 수정했다. 각 교체 선택지에 해당 오해가 틀린 이유를 적었다. 문항·목표를 추가하지 않았고 모든 ID·family·정답 위치·문항 출처 페이지를 유지했다. 기존 정답을 오답으로 바꾼 사례는 없다. 기존의 과도한 일반화 선택지는 개념과 직접 관련되면 일부 유지했다. 이 검토는 실제 학습자 난이도·변별도 측정을 대신하지 않는다.

프라이버시 공백은 `w07-hids-nids`의 설명·비교·예제·오개념·회상 확인과 p12 매핑으로 보완했다. 기록 무결성과 기밀성을 구분하고 수집 최소화·조회 권한·보존·폐기를 함께 다룬다. 근거는 교안 p12 및 [NIST SP 800-92 §2.1 각주 2, §2.3.2, §4.2, §5.1.3](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-92.pdf)다. 해당 과거 문서의 옛 암호 알고리즘·법정 기간을 현대 권고로 가져오지 않았다.

`w07-snort-options` 설명·비교·회상 확인과 `w07-q039`를 보완했다. `established`는 성립한 TCP 연결 상태를 요구하고 `stateless`는 스트림 상태와 관계없이 평가한다. 다른 헤더·내용 조건을 무시하거나 허용을 보장하지 않는다. q039의 정답 위치 c와 기존 연결 문맥이라는 정답 취지는 유지하고 비교 범위를 명시했다. 근거는 위 Snort 공식 flow 문서다.

수정 전 회귀 테스트를 먼저 실행했을 때 무관 선택지와 누락 설명 검사 2개가 실패하고 구조 검사는 통과했다(RED: 2 fail / 1 pass). 수정 후 `node --test test/content-part2-regression.test.js test/content.test.js`는 19개 모두 통과했다. 개별 `validateWeek()` 3개, 83쪽 매핑·목표 연결, 문항 수와 중요 계산·규칙 정답을 확인했다. 재생성 결과의 동일성과 UTF-8 무BOM·CRLF도 별도 확인했다. 테스트는 구조·정해진 회귀 사례의 증거이며 모든 선택지의 의미를 자동 판정하는 장치가 아니다.

수정 파일은 `tools/authoring/part-2.mjs`, `dist/content/week-05.json`, `dist/content/week-06.json`, `dist/content/week-07.json`, `test/content-part2-regression.test.js`, 이 문서뿐이다. 원고에 ID별 명시적 교체를 기록하고 JSON으로 직렬화하며 런타임 템플릿이나 문항 수 확장은 없다. PDF·렌더 원본은 추가하지 않았다.

자료 상태: `architecture.md`·`docs/content-contract.md`·로컬 PDF 검토 지침·세 JSON·원저자 감사 문서·담당 교안 전체 텍스트·coverage는 VERIFIED. 교안 시각 검토는 선택한 16쪽만 확인한 PARTIAL이다. 외부 공식 문서는 위 관련 절을 확인한 PARTIAL이며 전체 명세 완독·실기기 검증·브라우저 UI·배포·CI는 NOT_INSPECTED/NOT_RUN이다. 미검증 내부자 비율 외에 이번 범위에서 새로 발견한 미해결 사실 충돌은 없다.
