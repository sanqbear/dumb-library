# Waifu Library

게임·툴 등 프로그램을 한눈에 모아 관리하는 데스크톱 애플리케이션. 로컬 실행 파일과 스팀 설치 게임을 모두 등록해 두고, 커스텀 썸네일/아이콘, 태그, 검색, 정렬로 나만의 라이브러리를 꾸밀 수 있습니다.

> A desktop program-library manager (games, tools, etc.) with Steam integration, custom cover/icon curation, tags, and search.

## 주요 기능

- **두 가지 공급자**
  - 로컬 `.exe` 등록 (파일 선택 또는 드래그 앤 드롭)
  - 스팀 설치 게임 스캔 및 일괄 추가 (Windows 레지스트리 + `libraryfolders.vdf`)
- **커버/아이콘 커스터마이징**
  - OS 파일 선택 · 드래그 앤 드롭 · URL 직접 입력 · 스팀 CDN 아트워크 선택
  - 선택 후 비율별 크롭(커버 2:3, 아이콘 1:1) 적용
  - `sharp` 로 항상 600×900 / 256×256 WebP 로 정규화 저장
  - 스팀 게임은 CDN 커버 재다운로드, 로컬 캐시 아이콘 적용 버튼 제공
  - 로컬 `.exe` 는 Windows API (`System.Drawing.Icon`) 로 아이콘 자동 추출
- **탐색**
  - 전체 검색 (제목)
  - 공급자/태그 필터
  - 최신/오래된순, 이름순(ㄱ-ㅎ / ㅎ-ㄱ) 정렬
  - 상단 헤더에 `필터 / 전체` 카운트 실시간 표시
- **뷰 모드** — 그리드(카드) / 리스트(테이블) 전환
- **테마** — 다크 / 라이트 (Sakura Rose 팔레트)
- **다국어** — 한국어 · English · 日本語 · 简体中文 (OS 로케일 자동 감지)
- **커스텀 타이틀바** — Windows 네이티브 프레임 대신 앱 내장 컨트롤
- **포터블 빌드 지원** — 설치 없이 단일 실행 파일로 사용 가능

## 스크린샷

_추가 예정._

## 기술 스택

- **Electron 40** + `electron-vite` 5
- **Vue 3.5** + `<script setup>` TypeScript
- **Pinia 3** (라이브러리/설정 스토어)
- **Naive UI** (컴포넌트) + Sakura Rose 테마 오버라이드
- **Vue I18n 11** (네 개 로케일)
- **sharp** (썸네일/아이콘 WebP 인코딩)
- **vue-advanced-cropper** (이미지 크롭 UI)
- **electron-log** (파일 기반 로깅)

## 시작하기

### 필요 조건

- Node.js 20+ (권장: LTS)
- Windows 10/11 x64 (현재 빌드 타깃)
- 스팀 연동을 사용하려면 스팀 설치 필요 (선택 사항)

### 설치

```bash
git clone https://github.com/sanqbear/waifu-library.git
cd waifu-library
npm install
```

### 개발 모드

```bash
npm run dev
```

electron-vite 가 renderer HMR 과 함께 Electron 을 실행합니다.

### 브라우저 테스트베드 (UI 검토용)

```bash
npm run testbed
```

Electron 없이 브라우저에서 렌더러만 띄웁니다. `http://localhost:5180/index.testbed.html`
에서 실제 창 크기(1360 × 1010)를 그대로 재현한 프레임 안에 앱이 뜹니다.

- **창 크기** 프리셋과 **배율(맞춤 / 100%)** 로 좁은 창까지 확인 가능
- `window.electron` 은 `src/testbed/mockElectron.ts` 의 모의 구현으로 대체되며,
  라이브러리·설정은 localStorage 에 저장됩니다 (**데이터 초기화** 버튼으로 리셋)
- 표지·스크린샷은 `testbed-assets/lib/` 의 생성된 플레이스홀더 SVG 입니다.
  `public/` 밖에 있으므로 Electron 빌드에는 포함되지 않습니다
- 시드 데이터(`src/testbed/fixtures.ts`)는 표지 없는 항목, 긴 제목, 태그 0~5개,
  다국어 제목 등 UI 가 견뎌야 하는 경우를 일부러 섞어 둔 것입니다
- 앱은 iframe 안에서 실행되므로 naive-ui 가 body 로 텔레포트하는 모달·드로어도
  시뮬레이션된 창 안에 정상적으로 표시됩니다

프로그램 실행·탐색기 열기·아이콘 추출처럼 OS 가 필요한 기능은 동작하지 않고
콘솔에 로그만 남깁니다.

### 프로덕션 빌드

```bash
# 전체 빌드 + NSIS 설치 파일
npm run build:win

# 전체 빌드 + 설치 없이 디렉터리 형태 (테스트용)
npm run build:dir

# 전체 빌드 + 포터블 단일 실행 파일
npm run build:portable
```

산출물은 `release/` 폴더에 생성됩니다.

### 타입 체크만 실행

```bash
npx vue-tsc -b
```

## 사용 데이터 위치

Electron `userData` 아래에 모든 사용자 데이터가 저장됩니다.

| 항목 | 경로 |
| --- | --- |
| 라이브러리 메타데이터 | `userData/library.json` |
| 설정 | `userData/settings.json` |
| 썸네일 (WebP) | `userData/thumbnails/<programId>.webp` |
| 아이콘 (WebP) | `userData/icons/<programId>.webp` |
| 로그 | `userData/logs/app.log` |

Windows 기준 `userData` 는 `%APPDATA%\waifu-library` 입니다. 포터블 빌드에서는 실행 파일 옆 `data/` 하위로 대체됩니다.

## 프로젝트 구조

```
.
├── electron/                 # 메인 + 프리로드 (Node 컨텍스트)
│   ├── main.ts               # BrowserWindow, 프로토콜, IPC 등록
│   ├── preload/index.ts      # contextBridge 로 노출하는 API
│   └── services/             # 비즈니스 로직
│       ├── dataService.ts    # library.json / settings.json 영속화
│       ├── thumbnailService.ts
│       ├── iconService.ts    # PowerShell 기반 exe 아이콘 추출
│       ├── imageService.ts   # sharp 파이프라인, temp 관리
│       ├── steamService.ts   # 스팀 설치 스캔, CDN 커버, 캐시 아이콘
│       ├── fileService.ts    # 파일 다이얼로그, 프로세스 실행
│       └── logger.ts         # electron-log 래퍼
├── src/                      # Vue 렌더러
│   ├── App.vue
│   ├── main.ts
│   ├── components/
│   │   ├── layout/           # TitleBar, AppHeader
│   │   ├── library/          # Grid/List/Card/EmptyState
│   │   └── dialogs/          # Add/Edit/Crop/SteamArtwork
│   ├── composables/          # useImageInput, useThemeClass
│   ├── i18n/                 # 로케일 번들
│   ├── stores/               # Pinia (library/settings)
│   ├── styles/global.css
│   └── types/index.ts
├── docs/                     # 리뷰, 에이전트 노트
├── electron.vite.config.ts
├── package.json
└── LICENSE                   # GPL-3.0
```

## 라이선스

GNU GPL v3.0. 자세한 내용은 `LICENSE` 를 참고하세요.
