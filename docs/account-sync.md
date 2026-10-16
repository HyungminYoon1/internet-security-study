# 계정 진도 동기화 계약

GitHub Pages의 정적 화면에서 Neon 관리형 인증과 Data API를 사용한다. 별도 Vercel 서버나 랭킹 DB는 없다. 이메일 인증을 마친 사용자만 자기 학습 기록에 접근할 수 있다.

## 신뢰 경계와 데이터

- Auth가 이메일·해시 처리된 비밀번호·세션·인증 메타데이터를 관리한다. 앱은 이름·전화번호를 수집하지 않고 필수 이름에는 고정값 `학습자`를 쓴다. 관리형 로그인 기록에는 IP·브라우저 정보가 포함될 수 있다.
- 브라우저에는 공개 HTTPS endpoint와 고정 버전 SDK만 배포한다. Postgres 접속 정보는 배포하지 않는다. SDK의 JWT는 요청을 인증하며 앱 코드는 비밀번호·토큰을 localStorage/sessionStorage에 쓰지 않는다.
- Data API가 JWT를 검증한다. 공개 RPC는 invoker identity initializer를 실행하고, private SECURITY DEFINER 구현이 `emailVerified`와 강제 RLS를 확인한다. `study_service`는 NOLOGIN·NOBYPASSRLS다. authenticated/anonymous는 테이블 직접 접근 권한이 없다.
- 학습 상태에는 계정 UUID, 읽기, 풀이, 북마크, 설정, 진행 중 시험, 최근 결과가 들어간다. 로그인 이메일은 학습 상태 JSON에 복제하지 않는다. Private catalog는 검증에 필요한 문항 ID·범위·보기·정답 메타데이터다.
- CSP는 같은 출처와 두 Neon HTTPS endpoint만 네트워크 대상으로 허용한다. 같은 `hyungminyoon1.github.io` 출처의 다른 코드와 완전히 격리된 보안 경계는 아니므로 민감한 자유 입력은 받지 않는다.

## 네 개의 Data API 진입점

모두 POST `/rpc/<name>`이다. `study_pull`은 `{}`, 나머지는 `{ "p_request": request }`를 받는다. JWT는 Authorization 헤더로 전달한다. 사용자 ID를 request로 받지 않는다.

| RPC | 요청 | 결과와 규칙 |
| --- | --- | --- |
| `study_pull` | 없음 | 계정의 envelope. 만료된 시험은 먼저 서버 채점 |
| `study_sync` | epoch, baseRevision, operationId, changes | 읽기·풀이·결과 합치기, 북마크·설정 필드 버전 비교, acceptedVersions/acceptedRevision 반환 |
| `study_exam` | epoch, operationId, deviceId, action 및 동작별 필드 | start/save/takeover/finish. 한 기기 writer, generation 검사, 서버 기준 60분 |
| `study_reset` | epoch, revision, operationId | 확인한 revision만 초기화, 새 epoch. 이전 epoch의 대기 쓰기는 거부 |

Envelope는 `userId, epoch, revision, serverNow, state, versions, examWriter`를 포함한다. 상태 revision과 envelope revision은 같아야 한다. 정상 처리도 충돌이면 `status`와 최신 cloud를 함께 반환하므로 HTTP 200만으로 저장 성공을 판단하지 않는다.

`changes`는 read, attempts, bookmarks, settings, examHistory 배열만 허용한다. 풀이의 정답 여부·문항 연결·보기·날짜·범위와 시험 결과를 DB에서 다시 검증한다. 다른 사용자가 입력한 ID, 알 수 없는 필드, 크기 초과 요청은 허용하지 않는다.

## 두 기기가 동시에 학습할 때

1. 읽기와 독립 풀이는 ID로 합친다. 같은 ID·같은 내용 재전송은 한 번만 기록하며 같은 ID의 다른 내용은 거부한다.
2. 북마크와 설정에는 필드 버전이 있다. 자신이 읽은 뒤 다른 기기가 다른 값으로 바꾼 경우 화면에서 어느 값을 쓸지 선택한다. 서버 시각·기기 시각으로 임의 우선순위를 정하지 않는다.
3. 요청을 보내기 전에 계정별 outbox에 정확한 요청을 저장한다. 응답이 사라지면 동일 operationId·내용으로 재전송한다. 뒤늦은 재시도 응답은 최초 승인 버전을 유지해 오래된 의도를 최신 변경처럼 바꾸지 않는다.
4. 다른 기기의 초기화, 128 revision보다 오래된 기준, 손상·미지원 대기본, 저장소 오류, 영구 검증 실패는 자동 전송을 멈춘다. 백업과 명시적 최신 계정 재연결을 제공한다.
5. 로그아웃·계정 전환 시 이전 세션의 비동기 응답은 무시한다. 매 전송 전 관리형 세션의 사용자 ID를 확인한다. A 계정의 대기본은 B 계정으로 전송하지 않는다.

## 모의고사

시작 때 서버가 60분 마감을 정한다. 답안 수정은 현재 deviceId/generation에만 허용한다. 다른 기기에서 명시적으로 넘겨받으면 generation이 바뀌고 이전 기기의 쓰기가 거부된다. 마감과 답안은 유지한다. 종료·시간 초과 채점은 서버에서 한 번 수행한다. 네트워크가 끊겨 불확실한 답안 저장이 있으면 새 답안 수정 전에 대기 전송을 해결한다.

## 기존 기록과 보존 한도

기존 guest 원본은 로그인 시 보존한다. 확인한 가져오기는 읽기·풀이·북마크·완료 시험을 추가하며 계정 설정·진행 중 시험은 교체하지 않는다. guest의 진행 중 시험은 가져오지 않는다. 이미 같은 ID인데 내용이 다른 기록은 합치지 않는다.

최근 풀이 3,000건, 시험 결과 20회, 요청 영수증 128건, 대기 변경 500개를 보관한다. 상태/일반 요청 2 MiB, 시험 요청 128 KiB, 필드 버전 256 KiB, 로컬 outbox 4 MiB 상한이다. 계정당 분당 120 RPC admission 제한은 롤백된 요청까지 집계하는 전역 방어 장치가 아니다. 제공자 자체 인증·메일·무료 사용량 제한도 적용된다.

계정 진도 초기화는 명시적 확인 후 해당 계정에만 적용한다. 관리형 Auth에서 계정을 삭제하면 FK로 해당 진도·영수증이 함께 제거된다. 앱에는 계정 탈퇴 UI나 비활성 계정 자동 삭제를 추가하지 않았다. 제공자 백업의 보존과 브라우저 로컬 사본은 별개다. 공용 기기에서는 동기화·백업 후 로그아웃하고 사이트 데이터를 정리한다.

## 개발과 운영

- 마이그레이션은 001부터 순서대로 적용하며 체크섬이 일치하는 기존 파일은 재실행하지 않는다. 이미 적용한 파일을 수정하지 말고 새 파일을 추가한다.
- DB 접속 도구는 이 프로젝트의 정확한 host만 허용하고 TLS 인증서를 검증한다. `STUDY_DATABASE_URL`은 해당 프로세스에만 전달하며 값은 출력하지 않는다.
- `tools/live-account-check.mjs`는 실제 Neon에 격리된 테스트 계정을 만들고 직접 정리하므로 일반 CI에서 실행하지 않는다. 사용자 승인 범위 안의 운영 검증 때만 실행한다. 실제 메일함 수신과 관리형 OTP 검증은 구분한다.
- 로컬 프론트엔드의 인증 테스트에는 Neon의 localhost 허용이 필요하다. 검증 후 해제하고 공개 origin만 남긴다. DB Free를 유료로 전환하는 자동화는 없다.

공식 구조 참고: [Neon Auth](https://neon.com/docs/auth/overview), [인증 흐름](https://neon.com/docs/auth/authentication-flow), [Data API 접근 제어](https://neon.com/docs/data-api/access-control).
