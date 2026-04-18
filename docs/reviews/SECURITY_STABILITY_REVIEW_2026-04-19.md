# Waifu Library 안정성/보안 코드 리뷰 보고서

- 작성일: 2026-04-19 (Asia/Seoul)
- 대상 저장소: `F:\repos\waifu-library`
- 리뷰 범위: Electron main/preload/service 계층, Vue renderer, 데이터 저장 로직
- 방식: 정적 코드 리뷰(라인 기반), 실행 검증 시도(`npm run build`는 로컬 환경에서 `npm` 미설치로 미실행)

## 요약

현재 구현은 기능 동작은 단순/명확하지만, Electron 보안 기본선 대비 중요한 취약점이 다수 존재합니다. 특히 `webSecurity: false`와 광범위 IPC 노출, 경로/입력 검증 부재가 결합되면 렌더러 취약점 발생 시 메인 프로세스 기능 악용으로 이어질 가능성이 큽니다.

- 전체 위험도: 높음
- 즉시 조치 필요: 4건
- 안정성 개선 필요: 4건

## 주요 발견사항 (심각도 순)

### 1) [High] BrowserWindow에서 `webSecurity` 비활성화
- 위치: `electron/main.ts:35`
- 상세: `webPreferences.webSecurity = false`로 설정되어 있어 SOP/CORS 등 웹 보안 경계가 약화됩니다.
- 영향: 렌더러에 XSS/콘텐츠 주입이 생겼을 때, 로컬 리소스 접근 및 IPC 악용 위험이 상승합니다.
- 권장 조치:
  - `webSecurity: true`로 전환
  - 로컬 파일 노출이 필요하면 `protocol.registerFileProtocol` 또는 커스텀 스킴으로 제한적으로 제공
  - CSP 적용 강화

### 2) [High] 외부 URL 오픈 시 스킴 검증 없음
- 위치: `electron/main.ts:48-50`
- 상세: `setWindowOpenHandler`에서 `details.url`을 무검증으로 `shell.openExternal`에 전달합니다.
- 영향: `javascript:`, `file:`, 커스텀 스킴 등 의도치 않은 핸들러 실행 가능성.
- 권장 조치:
  - `new URL(details.url)` 파싱 후 `https:`/`http:`만 허용
  - 허용 도메인 allowlist 도입
  - 검증 실패 시 로깅 후 차단

### 3) [High] 아이콘 추출 PowerShell 스크립트 문자열 주입 가능성
- 위치: `electron/services/iconService.ts:29-56`
- 상세: `executablePath`를 PowerShell 스크립트 문자열에 직접 삽입합니다.
- 영향: 특수문자/이스케이프 조합에 따라 스크립트 인젝션 또는 예기치 않은 명령 실행 위험.
- 권장 조치:
  - 스크립트 문자열 생성 대신 안전한 인자 전달 방식 사용
  - 최소한 작은따옴표 기반 escaping 함수로 경로 인코딩
  - 가능하면 PowerShell 의존 제거(네이티브 라이브러리/OS API 사용)

### 4) [High] 저장된 경로를 신뢰하고 파일 삭제 수행
- 위치: `electron/services/dataService.ts:141-158`
- 상세: `program.iconPath`/`program.thumbnailPath`를 그대로 `fs.unlinkSync` 실행.
- 영향: `library.json`이 변조되면 앱 데이터 디렉터리 외부 파일 삭제 시도 가능.
- 권장 조치:
  - 삭제 전 `path.resolve` 후 `userData/icons`, `userData/thumbnails` 하위인지 검증
  - 심볼릭 링크/경로 역참조(`..`) 차단

### 5) [Medium] IPC 입력값 런타임 검증 부재
- 위치: `electron/main.ts:68-127`, `electron/preload/index.ts:56-87`
- 상세: 렌더러에서 전달된 데이터(`programId`, `executablePath`, `settings` 등)에 대한 shape/type/path 검증이 없습니다.
- 영향: 비정상 입력으로 데이터 손상, 예외 발생, 파일 시스템 오작동 가능.
- 권장 조치:
  - 메인 프로세스 핸들러에서 Zod/Joi 등으로 모든 IPC payload 검증
  - `programId`는 UUID 패턴 강제
  - 경로는 존재 여부 + 확장자 + 허용 디렉터리 정책 검증

### 6) [Medium] 라이브러리/설정 파일 원자적 저장 미적용
- 위치: `electron/services/dataService.ts:57-67`, `210-219`
- 상세: `writeFileSync` 직저장 방식으로 중간 실패 시 파일 손상 가능.
- 영향: 앱 종료/충돌/디스크 이슈 시 JSON 파손 및 데이터 유실.
- 권장 조치:
  - `*.tmp`에 기록 후 `rename`으로 원자적 교체
  - JSON parse 실패 시 백업 복구(`.bak`) 루틴 추가

### 7) [Medium] 로그에 로컬 절대경로/실행 경로 노출
- 위치: `electron/services/fileService.ts:23,46,55`, `iconService.ts:75`, `dataService.ts:145,155`
- 상세: 사용자 파일 시스템 경로가 로그에 그대로 남습니다.
- 영향: 로그 유출 시 개인정보/환경 정보 노출.
- 권장 조치:
  - 운영 로그 레벨 축소
  - 경로 마스킹(파일명만 남기기)
  - 에러 로그에 민감 데이터 제외

### 8) [Low] 창 포커스 비존재 시 non-null 단언으로 예외 가능
- 위치: `electron/services/fileService.ts:8`, `31`
- 상세: `BrowserWindow.getFocusedWindow()!` 사용.
- 영향: 특정 타이밍(포커스 전환/초기화)에서 예외 가능.
- 권장 조치:
  - `window ?? BrowserWindow.getFocusedWindow() ?? undefined` 처리
  - null-safe 분기 추가

## 안정성 관점 추가 코멘트

- 스키마 검증 없는 `library.json` 로드
  - 위치: `electron/services/dataService.ts:45`
  - 현재는 타입 단언만 수행해 필드 누락/타입 불일치 시 후속 로직에서 런타임 오류 가능.
- 테스트 부재
  - 단위/통합 테스트 코드가 저장소 내 확인되지 않았고, 회귀 방어선이 약함.
- 빌드 검증 한계
  - 본 리뷰 환경에서는 `npm` 명령이 없어 `npm run build`를 실행하지 못함.

## 우선순위 개선 로드맵

1. Electron 보안 기본선 복구 (즉시)
- `webSecurity: true`
- 외부 URL allowlist
- IPC payload 검증

2. 파일 시스템 안전장치 (단기)
- 삭제/복사 대상 경로 제한
- 원자적 저장 + 백업 복구

3. 실행 경로/썸네일 처리 강화 (단기)
- 실행파일/이미지 확장자 및 실제 파일 타입 검증
- `programId` UUID 강제

4. 운영 안정성 강화 (중기)
- 에러 경계/로깅 마스킹
- 핵심 서비스 테스트(데이터 로드/저장/삭제, IPC 핸들러)

## 재점검 체크리스트

- `webSecurity` 활성화 후 이미지 로딩(`file://`)이 문제 없이 동작하는가?
- 변조된 `library.json` 입력 시 앱이 안전하게 거부/복구되는가?
- 허용되지 않은 URL 스킴이 `openExternal`에서 차단되는가?
- 아이콘 추출 실패 시 임시 파일이 항상 정리되는가?
- 앱 비정상 종료 중 저장 작업에도 JSON 무결성이 유지되는가?
