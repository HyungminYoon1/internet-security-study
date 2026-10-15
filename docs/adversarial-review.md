# 상태·백업 경계 회귀 검토

확인일: 2026-10-15. 구현을 수정하지 않고 `test/adversarial.test.js`에 공개 API 기반 회귀 테스트를 작성했다. 모든 저장 동작은 테스트용 메모리 어댑터에만 발생한다. 실제 사용자 저장소·브라우저·계정·백업 파일은 건드리지 않았다.

## 결과

```text
node --test --test-reporter=spec test/adversarial.test.js
tests 4
pass 0
fail 4
exit code 1
```

네 테스트가 세 원인을 재현한다. 의도적으로 실패하는 회귀 테스트이므로 부모가 구현을 수정한 뒤 같은 명령으로 GREEN을 확인해야 한다.

비교 기준으로 아래 기존 검사도 실행했다.

```text
node --test --test-reporter=spec test/learning.test.js test/storage.test.js
tests 11
pass 11
fail 0
exit code 0
```

기존 성공 검사는 잘못된 JSON 거절·할당량 오류·일반 탭 충돌·시험 제한시간·중복 attempt ID 등을 다루지만 이번 실패 경계를 포함하지 않는다. 실제 브라우저에서 저장 권한을 변경하거나 경쟁 조건을 재현한 결과가 아니라 공개 저장 어댑터에 대한 결정적 Node 재현이다.

## 1. [P1] 실패로 보고한 복원이 이전 영구 기록을 교체한다

위치: `dist/src/storage.js:18-32`, 특히 24행 쓰기, 25행 readback, 28행 catch. 회귀: ADV-01.

재현 조건은 기존 풀이·읽기·북마크가 정상 저장된 상태에서 정상 백업을 복원하되, 교체 쓰기 직후 최초 readback만 한 번 예외가 발생하는 것이다. 예외 후의 읽기·쓰기는 정상이다. 저장 쓰기를 무시하는 기존 테스트와 달리 새 값이 실제로 저장된 뒤 확인만 실패하는 조건이다.

확인된 결과는 `restore()`가 `{ ok: false, reason: 'write-failed' }`를 반환하고 현재 인스턴스의 `raw()`는 이전 바이트를 보유하지만, 실제 저장 값은 이미 새 백업으로 바뀌어 이전 풀이가 사라지는 것이다. 실패 직후 새 저장소 인스턴스를 열면 사용자가 실패했다고 안내받은 교체 결과가 로드된다. 실패 시 현재 기록 보존이라는 architecture.md의 복원 계약과 다르다. 이전 바이트는 현재 인스턴스의 원본 내보내기로는 복구 가능하지만 새로고침 이후에도 그것이 남는다고 보장할 수 없다.

정확한 실패:

```text
restore said it failed, but it erased the persisted prior attempt
actual persisted.attempts: []
expected: [prior-attempt]
```

제안: 복원 전 스냅샷을 보관하고, 쓰기 이후 실패하면 현재 저장 값이 이번 작업이 쓴 값과 같은지 다시 확인한 뒤에만 이전 값을 복구한다. 다른 탭 값이면 그 값을 덮어쓰지 말아야 한다. 재확인·복구까지 불가능한 상황은 원본 보존 또는 성공을 단정하지 않고 불확실한 저장 결과로 구분하고 원본 내보내기를 유지해야 한다. localStorage가 원자적 다중 탭 트랜잭션을 제공한다는 주장은 하지 않는다. ADV-01은 후속 읽기가 복구되는 한정된 조건이라 안전한 비교 후 복구가 가능한 사례다.

## 2. [P2] 손상 기록 뒤 명시적 정상 백업 복원도 차단된다

위치: `dist/src/storage.js:5-19,30-32`, 앱 연결: `dist/src/app.js:154-159`. 회귀: ADV-02.

손상된 현재 기록을 읽으면 자동 저장을 막고 원본을 보존하는 동작은 올바르다. 그러나 앱의 백업 미리보기와 확인 대화상자를 통과한 정상 복원도 `restore() -> save()`를 거쳐 같은 `blocked` 분기에서 거절된다. 현재 원본이 그 사이 바뀌지 않았고 입력 백업이 유효해도 성공할 수 없다. 기록 초기화와 백업 재선택을 해야 복원할 수 있어 명시적 복원 기능이 복구 상황에서 동작하지 않는다.

정확한 실패:

```text
confirmed valid restore is unusable after corrupt load: blocked
actual result.ok: false
expected result.ok: true
```

테스트는 자동 저장이 계속 차단되고, 잘못된 백업이 원본을 바꾸지 않는다는 선행 조건도 검증한다. 명시적 복원 전에 원본을 읽을 수 없었다면 원본이 실제로 바뀌었는지 비교할 수 없으므로 무조건 복원을 허용해서는 안 된다. 이 재현은 원본 문자열 자체는 정상적으로 읽혔지만 JSON이 손상된 경우로 한정했다.

제안: 자동 저장 차단 이유와 사용자가 확인한 교체 경로를 구분한다. 유효 백업을 먼저 검증하고 보유한 baseline과 현재 바이트가 일치하는지 확인한 경우에만 명시적 복원 경로로 교체한다. 단순히 모든 blocked 상태를 해제하면 다른 탭 충돌·읽기 권한 실패를 무시하므로 안 된다. 원본 내보내기는 교체 전 계속 제공한다.

## 3. [P2] 빈 배열 슬롯이 검증을 통과하여 정상 기록의 재로딩을 막는다

위치: `dist/src/domain/backup.js:11`, `dist/src/storage.js:22-26`. 회귀: ADV-03, ADV-04.

`list()`의 `forEach(check)`는 sparse array의 없는 슬롯을 건너뛴다. 따라서 `read`, `bookmarks`, `attempts`, `examHistory`에 각각 `Array(1)`을 넣은 상태가 `validateState()`를 모두 통과한다. 이 배열은 길이 0의 정상 빈 배열과 다르다. JSON 직렬화는 해당 슬롯을 `null`로 바꾸고, 이 null은 다음 load에서 검증에 실패한다.

정확한 실패:

```text
ADV-03 accepted: ['read', 'bookmarks', 'attempts', 'examHistory']
expected accepted: []

ADV-04 save.ok=true, but reopening now rejects this app's own stored record
actual reloaded.ok: false
expected reloaded.ok: true
```

ADV-04는 기존에 정상 풀이가 들어 있는 저장소에서 read만 빈 슬롯으로 바꾼 상태를 save한다. 성공 응답과 readback까지 통과하지만, 새 인스턴스 load는 실패하고 빈 초기 상태를 반환한다. 원본의 풀이 바이트는 불러올 수 없는 기록 안에 남아 있으므로 물리적 삭제라고 표현하지 않는다. 자동 저장은 다시 차단되고 학습자가 정상 풀이를 이용할 수 없게 된다.

도달 범위: JSON 백업 파일에는 sparse slot을 그대로 표현할 수 없으므로 이것은 JSON 가져오기를 통한 현재 원격 공격이 아니다. `validateState`/`save`가 받는 메모리 상태 입력의 검증 결함이다. 현재 앱의 일반 버튼 경로가 sparse 배열을 만든다는 증거는 발견하지 않았다. 그럼에도 잘못된 API 입력을 성공으로 확인하며 이전 정상 저장소까지 읽을 수 없게 만드는 계약 위반이므로 별도 회귀로 남긴다.

제안: 모든 인덱스의 존재를 검사하거나 슬롯을 건너뛰지 않는 반복으로 각 값을 검증한다. undefined/null을 필드별 원소 검사에서 거절하고, 최종 직렬화한 JSON을 다시 파싱·검증한 뒤 쓰는 방어도 고려한다. 잘못된 후보 상태를 거절할 때는 이미 저장된 원본을 바꾸지 않아야 한다.

## 점검 범위와 비발견 사항

명시된 구현 파일은 모두 VERIFIED(전체 읽기)다.

| 파일 | 읽고 검토한 경계 |
| --- | --- |
| dist/src/domain/learning.js | 범위·문항/family 선택, 정답 ID, 중복 시도, 복습 상태, 시험 생성/답안/종료/시간 |
| dist/src/domain/backup.js | 구조·버전·목록/수치 한계, 시도 정오 재계산, 시험 범위·보기 순서·점수 검증, 가져오기 |
| dist/src/domain/content.js | 주차·쪽수·ID/보기·참고 URL·coverage·전체 catalog 연결 |
| dist/src/storage.js | baseline·revision·탭 충돌·쓰기/readback·복원·초기화·원본 내보내기 |
| dist/src/app.js | 저장 실패의 메모리 상태, 시험 완료·복습 연결, 백업 확인/교체, storage 이벤트 |

추가로 architecture.md와 docs/content-contract.md, 기존 네 테스트 파일 전체, 시험/문제 화면과 상태 연결을 확인하기 위한 dist/src/views/practice.js를 읽었다. 구현 파일은 수정하지 않았다.

일반적인 서로 다른 탭의 순차 저장 충돌은 기존 테스트에서 거절되었다. 원자적 다중 탭 저장을 보장하지 않는다는 문서 한계를 이미 전제하므로 임의 재진입 어댑터로 경쟁을 만든 뒤 그것을 새로운 데이터 손실 결함으로 주장하지 않았다.

검증된 정상 상태를 사용하는 기존 시험의 범위·60분 만료·지연 답안 거절·중복 attempt 효과와 추측/힌트의 secure 억제에는 이번 실행에서 새로운 실패를 확인하지 못했다. 앱 내부 비공개 함수의 동작을 테스트에서 재작성해 허위 RED 근거로 삼지 않았다. 실제 DOM·대화상자·다중 브라우저 탭을 통한 동작은 부모의 브라우저 QA 범위로 남는다.

검토 시점 구현 스냅샷 SHA-256(공유 작업 중이므로 후속 변경 시 재실행 필요):

```text
learning.js 742B96DE7691F1C029B09FEC207236D4E8B3D7617E913FC43CDC29A6E3607F2E
backup.js   2E0C06B8AC0EE29D4490927862B25CCF0844B9E643DDC882F4DC7C305EA53D07
content.js  E9678B38D6C72E845551D364F989BDB2715CD0A33744A6525D4FD2AC8EF383BD
storage.js  E3C9E8C702BDBA285E9B97B04A8DD80969171AFC08E25E8FDD68EB15E7D8ADF3
app.js      89DC8CEEB9C82D83312A09A0A9D3DCD789EA3366933A64C02BCB089D9D6B77C6
```

이 작업의 변경은 test/adversarial.test.js와 이 문서다. 별도 추가 승인에 따라 docs/content-audit-part-3.md의 개인 머신 절대 경로 세 곳만 비개인 PDF skill 표기·학습 워크스페이스 상대 경로로 교체했다. 콘텐츠 JSON과 저작 소스, 다른 작업자의 감사 문서는 변경하지 않았다. 커밋·푸시·게시도 하지 않았다.

## 통합 구현 후 확인 — 2026-10-15

위 결과는 수정 전 RED 증거다. 통합 작업에서 ADV-01~04를 모두 재현한 뒤 수정했고, 같은 네 회귀가 PASS로 전환되었다. 일시 readback 실패는 재시도로 실제 저장 성공을 확인하며, 지속 실패는 성공/원상복구를 단정하지 않고 write-uncertain으로 구분한다. 손상 JSON은 자동 저장 차단을 유지하되 사용자가 확인한 유효 백업만 변하지 않은 baseline과 비교하여 교체한다. 배열 슬롯과 직렬화 왕복 검증으로 잘못된 메모리 상태의 저장을 차단한다. 세부 정책은 decisions.md D04, 최종 로컬·CI·배포 결과는 verification.md를 따른다. 다른 탭의 값을 덮어쓰는 자동 롤백은 도입하지 않았다.
