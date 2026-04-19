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
