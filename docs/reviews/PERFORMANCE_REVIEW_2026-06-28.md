# Waifu Library 성능 코드 리뷰 보고서

- 작성일: 2026-06-28 (Asia/Seoul)
- 대상 저장소: `F:\repos\me\waifu-library`
- 리뷰 범위: Electron main/preload/service 계층, Vue renderer, 라이브러리 데이터 저장/조회 흐름, 이미지/Steam 연동 흐름
- 방식: 정적 코드 리뷰(라인 기반). 런타임 프로파일링은 수행하지 않음.

## 요약

현재 구현은 개인용/소규모 라이브러리에서는 충분히 단순하고 유지보수하기 쉬운 구조입니다. 다만 프로그램 수가 수백~수천 개로 늘어나거나 Steam 게임을 한 번에 많이 추가하는 상황에서는 선형 비용이 겹치면서 체감 지연이 커질 가능성이 있습니다.

- 전체 성능 위험도: 중간
- 우선 개선 권장: Steam 다중 추가 배치화, 그리드/리스트 가상화
- 장기 개선 후보: in-memory 데이터 캐시, 비동기 저장 큐, SQLite 등 embedded DB 도입

## 주요 발견사항 (우선순위 순)

### 1) [P1] Steam 다중 추가가 JSON 전체 저장을 항목마다 반복

- 위치:
  - `electron/main.ts:272-286`
  - `electron/services/dataService.ts:214-237`
  - `electron/services/dataService.ts:352-358`
- 상세: `steam:addPrograms` 핸들러가 `entries`를 직렬 루프로 순회하면서 각 항목마다 `dataService.addSteamProgram()`을 호출합니다. 이 함수는 매번 `loadLibrary()` 후 `saveLibrary()`를 수행합니다. 이후 썸네일 다운로드가 성공하면 `updateProgramThumbnailPath()`가 다시 전체 라이브러리를 읽고 씁니다.
- 영향: Steam 게임 N개를 추가하면 `library.json` 전체 read/parse/stringify/write가 최대 2N회 발생합니다. 네트워크 썸네일 다운로드도 직렬 처리되어 다중 추가 작업의 완료 시간이 길어질 수 있습니다.
- 권장 조치:
  - `addSteamProgramsBatch(entries)` 같은 배치 API를 추가해 라이브러리를 한 번만 읽고 가능한 한 한 번만 저장합니다.
  - 프로그램 항목 생성과 썸네일 다운로드를 분리합니다. 먼저 항목을 빠르게 추가하고, 썸네일은 백그라운드 작업으로 갱신하는 방식이 좋습니다.
  - 썸네일 다운로드는 무제한 병렬이 아니라 3~5개 정도의 제한된 병렬성으로 처리합니다.

### 2) [P1] 그리드 뷰가 필터 결과 전체를 DOM 컴포넌트로 렌더링

- 위치:
  - `src/components/library/LibraryGrid.vue:8-15`
  - `src/components/library/ProgramCard.vue:145-164`
- 상세: `LibraryGrid`는 `libraryStore.filteredPrograms` 전체를 `ProgramCard`로 렌더링합니다. 각 카드에는 `NImage`가 포함되므로 프로그램 수가 증가할수록 Vue 컴포넌트 생성, 레이아웃 계산, 이미지 요청이 함께 증가합니다.
- 영향: 수백~수천 개 프로그램을 보유한 라이브러리에서 초기 렌더링, 검색 결과 갱신, 스크롤 성능이 저하될 수 있습니다.
- 권장 조치:
  - 그리드에 virtual scrolling 또는 pagination/infinite scroll을 도입합니다.
  - 카드 이미지에 lazy loading 전략을 적용합니다. `NImage`가 내부적으로 lazy loading을 충분히 제공하지 않는다면 native `img loading="lazy"` 또는 IntersectionObserver 기반 컴포넌트를 검토합니다.
  - 리스트 뷰의 `NDataTable`도 데이터 규모가 커질 경우 virtual scroll 옵션 적용을 검토합니다.

### 3) [P2] 검색/필터/정렬이 입력 변경마다 전체 배열을 재처리

- 위치: `src/stores/libraryStore.ts:38-76`
- 상세: `filteredPrograms` computed는 매번 `programs` 배열을 복사하고, 검색어/카테고리/태그 필터를 적용한 뒤 `localeCompare` 기반 정렬을 수행합니다. 검색어는 IME live 입력 경로와 연결되어 있어 입력 중에도 재계산될 수 있습니다.
- 영향: 프로그램 수가 많아질수록 검색 입력마다 main thread 작업량이 증가합니다. 특히 한글 정렬의 `localeCompare` 비용이 반복될 수 있습니다.
- 권장 조치:
  - 검색 입력에 100~150ms 수준의 debounce를 적용합니다.
  - 프로그램 로드/수정 시 `searchTextLower` 같은 검색용 파생 필드를 미리 계산합니다.
  - 정렬 기준별로 정렬된 배열을 캐시하거나, 정렬과 필터링 순서를 데이터 규모에 맞게 조정합니다.
  - 태그 필터는 `selectedTags`를 `Set`으로 변환해 반복 membership 비용을 줄일 수 있습니다.

### 4) [P2] 데이터 서비스가 동기 파일 I/O 중심

- 위치:
  - `electron/services/dataService.ts:141-180`
  - `electron/services/dataService.ts:183-267`
  - `electron/services/dataService.ts:339-372`
- 상세: `loadLibrary()`는 `readFileSync`, `saveLibrary()`는 `JSON.stringify`와 atomic write를 동기로 수행합니다. 추가/수정/삭제/이미지 경로 갱신은 대부분 매번 전체 라이브러리를 다시 읽고 전체 파일을 다시 씁니다.
- 영향: Electron main process가 파일 I/O와 JSON 처리 중 막히면 IPC 응답, 창 이벤트, 커스텀 이미지 프로토콜 처리도 지연될 수 있습니다.
- 권장 조치:
  - 단기: 프로세스 내부에 in-memory library cache를 두고, 변경 작업은 cache를 갱신한 뒤 저장 큐에 넣습니다.
  - 단기: 연속 변경은 debounce 또는 write queue로 합쳐 저장합니다.
  - 중기: 데이터가 커질 가능성이 높다면 SQLite 같은 embedded DB를 도입해 항목 단위 update/query로 전환합니다.

### 5) [P2] 프로그램 추가 시 아이콘 추출이 추가 흐름을 붙잡음

- 위치:
  - `src/stores/libraryStore.ts:106-126`
  - `electron/services/iconService.ts:57-88`
- 상세: 로컬 프로그램 추가 후 renderer action은 `window.electron.extractIcon()`을 기다립니다. 메인 프로세스에서는 PowerShell 프로세스를 실행하고, timeout은 15초입니다.
- 영향: 느린 디스크, 네트워크 드라이브, 손상된 실행 파일 등에서 프로그램 추가 UI가 오래 loading 상태로 남을 수 있습니다.
- 권장 조치:
  - 프로그램 항목은 즉시 추가하고 아이콘 추출은 백그라운드 작업으로 분리합니다.
  - 아이콘 추출 완료 시 IPC event 또는 store refresh로 해당 항목만 갱신합니다.
  - 실패한 아이콘 추출은 재시도 버튼 또는 수동 아이콘 지정 흐름으로 처리합니다.

### 6) [P3] URL 이미지 다운로드가 응답 전체를 메모리에 올린 뒤 크기 검사

- 위치:
  - `electron/services/imageService.ts:170-190`
  - `electron/services/steamService.ts:149-169`
- 상세: URL 이미지 다운로드가 `response.arrayBuffer()`로 전체 응답을 메모리에 올린 뒤 byte length를 검사합니다. `imageService`에는 20MB 제한이 있지만, 검사는 다운로드 완료 후 수행됩니다. Steam 썸네일 다운로드 경로에는 명시적인 크기 제한이 없습니다.
- 영향: 비정상적으로 큰 응답이나 잘못된 서버 응답에서 메모리 피크가 커질 수 있습니다.
- 권장 조치:
  - `Content-Length`가 있으면 다운로드 전 크기를 확인합니다.
  - stream reader로 읽으면서 누적 크기가 제한을 넘으면 중단합니다.
  - Steam 썸네일 다운로드에도 동일한 최대 크기 제한을 적용합니다.

### 7) [P3] Steam 설치 게임 스캔이 동기 디렉터리/파일 스캔 중심

- 위치: `electron/services/steamService.ts:72-134`
- 상세: Steam library folder와 appmanifest 파일들을 `readdirSync`, `readFileSync`로 순회합니다.
- 영향: 일반적으로 manifest 파일 수가 많지 않아 심각하지는 않지만, 라이브러리가 여러 드라이브에 분산되어 있거나 느린 디스크에 있는 경우 scan IPC 응답이 늦어질 수 있습니다.
- 권장 조치:
  - 스캔 결과를 짧은 TTL로 캐시합니다.
  - 필요 시 async fs API로 전환하고, 스캔 중 UI에 진행 상태를 표시합니다.

## 우선순위 개선 로드맵

### 1단계: 체감 성능 개선 폭이 큰 항목

1. Steam 다중 추가를 배치 처리로 변경합니다.
2. 썸네일 다운로드를 제한된 병렬 작업으로 분리합니다.
3. 그리드/리스트 가상화 또는 pagination을 도입합니다.

### 2단계: 입력/렌더링 비용 절감

1. 검색 입력에 debounce를 적용합니다.
2. 검색용 lower-case 문자열을 프로그램별로 캐시합니다.
3. 정렬 결과 또는 sort key를 캐시합니다.
4. 이미지 lazy loading을 명시적으로 적용합니다.

### 3단계: 저장 계층 개선

1. `library.json`을 in-memory cache + save queue 구조로 바꿉니다.
2. 연속 update는 debounce로 병합합니다.
3. 데이터 규모가 커질 경우 SQLite 전환을 검토합니다.

### 4단계: 백그라운드 작업화

1. 아이콘 추출을 프로그램 추가 흐름에서 분리합니다.
2. Steam 썸네일 다운로드를 백그라운드 갱신으로 전환합니다.
3. 진행 상태와 실패 상태를 항목별로 표현합니다.

## 검증 제안

성능 개선 전후를 비교하려면 다음 시나리오를 측정하는 것이 좋습니다.

- 프로그램 100개, 500개, 1000개에서 앱 초기 로드 시간
- 그리드 뷰 첫 렌더링 시간과 스크롤 FPS
- 검색어 입력 후 결과 갱신까지 걸리는 시간
- Steam 프로그램 10개, 50개 다중 추가 완료 시간
- 이미지가 있는 카드와 없는 카드가 섞인 상태에서 메모리 사용량

## 간단한 측정 훅 제안

개발 빌드에서만 다음 구간에 `performance.mark()` 또는 `console.time()`을 임시로 넣어 측정할 수 있습니다.

- `libraryStore.loadLibrary()` 시작/완료
- `filteredPrograms` computed 실행 시간
- `steam:addPrograms` IPC 핸들러 전체 시간
- 개별 썸네일 다운로드/처리 시간
- `LibraryGrid` mount 후 첫 paint까지의 시간

## 결론

현재 구조의 가장 큰 장점은 단순함입니다. 따라서 바로 DB를 도입하기보다는, 먼저 Steam 다중 추가 배치화와 목록 가상화를 적용하는 것이 비용 대비 효과가 가장 큽니다. 그 다음 검색/정렬 캐시와 저장 큐를 넣으면 개인용 라이브러리 규모가 커져도 충분히 부드럽게 동작할 가능성이 높습니다.
