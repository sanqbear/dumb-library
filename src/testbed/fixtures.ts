/**
 * Seed data for the browser testbed.
 *
 * Shaped to exercise the cases the real library actually contains and the UI
 * has to survive: entries with no cover art, very long titles, CJK and Latin
 * titles side by side, tag counts from zero to overflowing, both providers,
 * markdown memos, and programs with and without screenshots.
 *
 * All titles, circles and paths are invented.
 */
import type { Developer, LibraryData, Program, Tag } from '../types'

const STAMP = '2026-05-14T09:00:00.000Z'

const dev = (id: string, ko: string, en?: string, ja?: string, zh?: string): Developer => ({
  id,
  names: { ko, en, ja, 'zh-CN': zh },
  createdAt: STAMP,
  updatedAt: STAMP
})

export const DEVELOPERS: Developer[] = [
  dev('dev-1', '푸른등대', 'Blue Lighthouse', 'あおい灯台', '蓝色灯塔'),
  dev('dev-2', '삼월의 창', 'March Window', '三月の窓'),
  dev('dev-3', '노을공방', 'Sunset Atelier', '夕暮工房', '夕阳工坊'),
  dev('dev-4', '스튜디오 안개', 'Studio Haze'),
  dev('dev-5', '고양이자리', 'Cattus', '猫座'),
  dev('dev-6', '한밤의 서랍', 'Midnight Drawer', '真夜中の抽斗')
]


// Tag master list. Seeds carry tag names; buildPrograms maps them to ids, the
// way the app stores them.
const TAG_SEEDS: Array<[ko: string, en: string, ja?: string, zh?: string]> = [
  ['비주얼노벨', 'Visual Novel', 'ビジュアルノベル', '视觉小说'],
  ['어드벤처', 'Adventure', 'アドベンチャー', '冒险'],
  ['퍼즐', 'Puzzle', 'パズル', '解谜'],
  ['액션', 'Action', 'アクション', '动作'],
  ['로그라이크', 'Roguelike', 'ローグライク', 'роguelike'],
  ['호러', 'Horror', 'ホラー', '恐怖'],
  ['힐링', 'Healing', '癒し', '治愈'],
  ['탐색', 'Exploration', '探索', '探索'],
  ['스토리', 'Story', 'ストーリー', '剧情'],
  ['분기', 'Branching', '分岐', '分支'],
  ['단편', 'Short', '短編', '短篇'],
  ['풀보이스', 'Full Voice', 'フルボイス', '全语音'],
  ['한글화', 'Korean Patch', '韓国語化', '韩化'],
  ['일본어', 'Japanese', '日本語', '日语'],
  ['무료', 'Free', '無料', '免费'],
  ['멀티', 'Multiplayer', 'マルチ', '多人'],
  ['미분류', 'Unsorted', '未分類', '未分类']
]

export const TAGS: Tag[] = TAG_SEEDS.map(([ko, en, ja, zh], i) => ({
  id: `tag-${String(i + 1).padStart(2, '0')}`,
  names: { ko, en, ja, 'zh-CN': zh },
  keyword: '',
  createdAt: STAMP,
  updatedAt: STAMP
}))

const TAG_ID_BY_NAME = new Map(TAGS.map(tag => [tag.names.ko, tag.id]))

const tagIds = (names: string[]): string[] =>
  names.map(name => TAG_ID_BY_NAME.get(name)).filter((id): id is string => !!id)

const MEMO_MARKDOWN = `구입: **2025년 겨울** 이벤트 현장판

> 사운드트랙 CD가 동봉된 초회판.
> 디스크 이미지는 백업 드라이브에 보관 중.

- 세이브 데이터는 \`%APPDATA%/bluelighthouse\` 아래
- 패치 1.02 적용 완료
- 한글 패치는 [공식 배포처](https://example.com/patch)에서

---

재설치할 때 *반드시* 패치부터 확인할 것.`

const SHORT_MEMO = `엔딩 3개 중 2개 확인.

- [ ] 진엔딩 남음
- 공략은 https://example.com/guide 참고`

type Seed = {
  title: string
  developerId: string | null
  tags: string[]
  cover: number | null
  shots: number[]
  memo: string
  steam?: boolean
  market?: string
  keywords?: string[]
  folder: string
  publisherId?: string | null
}

const SEEDS: Seed[] = [
  { title: '별이 지는 해안선', developerId: 'dev-1', tags: ['어드벤처', '스토리', '한글화'], cover: 1, shots: [1, 2, 3], memo: MEMO_MARKDOWN, market: 'https://example.com/store/1', folder: 'ShorelineOfFallingStars', publisherId: 'dev-3' },
  { title: '夜明けまでのカウントダウン', developerId: 'dev-2', tags: ['비주얼노벨', '일본어', '풀보이스', '분기'], cover: 2, shots: [4, 5], memo: SHORT_MEMO, folder: 'CountdownToDawn', publisherId: 'dev-6' },
  { title: 'Paper Lantern Drift', developerId: 'dev-3', tags: ['퍼즐', '힐링'], cover: 3, shots: [6], memo: '', folder: 'PaperLanternDrift' },
  { title: '유리창 너머의 계절', developerId: 'dev-1', tags: ['비주얼노벨', '스토리'], cover: 4, shots: [7, 8, 9], memo: '초회 특전 태피스트리 포함.', folder: 'SeasonBeyondGlass' },
  { title: '기나긴 복도의 끝에서 우리는 다시 만나기로 했다', developerId: 'dev-4', tags: ['호러', '탐색', '단편', '무료', '한글화'], cover: 5, shots: [10], memo: '', folder: 'AtTheEndOfTheCorridor' },
  { title: '猫と路地裏', developerId: 'dev-5', tags: ['탐색'], cover: 6, shots: [11, 12], memo: '### 진행 상황\n\n1. 1장 클리어\n2. 2장 진행 중', folder: 'CatsAndAlleys' },
  { title: 'Quiet Hours', developerId: 'dev-3', tags: [], cover: 7, shots: [], memo: '', folder: 'QuietHours' },
  { title: '서랍 속의 편지', developerId: 'dev-6', tags: ['비주얼노벨', '단편', '한글화'], cover: 8, shots: [1, 4], memo: SHORT_MEMO, folder: 'LetterInTheDrawer' },
  { title: '무제 프로젝트 (개발판)', developerId: null, tags: ['미분류'], cover: null, shots: [], memo: '빌드만 받아둔 상태. 실행 파일 경로 확인 필요.', folder: 'untitled_build_0417' },
  { title: '灯りのない図書館', developerId: 'dev-2', tags: ['어드벤처', '분기', '일본어'], cover: 9, shots: [2, 5, 7], memo: '', folder: 'LibraryWithoutLights' },
  { title: 'Salt & Static', developerId: 'dev-4', tags: ['로그라이크', '액션'], cover: 10, shots: [3], memo: '', steam: true, market: 'https://store.steampowered.com/app/000000', folder: 'SaltAndStatic', publisherId: 'dev-1' },
  { title: '여름의 잔상', developerId: 'dev-1', tags: ['비주얼노벨', '풀보이스'], cover: 11, shots: [6, 8], memo: MEMO_MARKDOWN, folder: 'AfterimageOfSummer' },
  { title: '오후 네 시의 관측소', developerId: 'dev-6', tags: ['힐링', '스토리', '한글화'], cover: 12, shots: [9], memo: '', folder: 'Observatory1600' },
  { title: '風の通り道', developerId: 'dev-5', tags: ['퍼즐', '단편'], cover: null, shots: [10, 11], memo: '표지 이미지 아직 안 넣음.', folder: 'WindPassage' },
  { title: 'Understory', developerId: 'dev-3', tags: ['탐색', '무료'], cover: 13, shots: [], memo: '', folder: 'Understory' },
  { title: '두 번째 겨울', developerId: 'dev-6', tags: ['비주얼노벨', '스토리', '분기', '한글화', '풀보이스'], cover: 14, shots: [12, 1, 2], memo: SHORT_MEMO, folder: 'TheSecondWinter' },
  { title: '되감기', developerId: 'dev-2', tags: ['어드벤처'], cover: 15, shots: [3, 4], memo: '', folder: 'Rewind' },
  { title: 'Northbound Signal', developerId: 'dev-4', tags: ['액션', '로그라이크', '멀티'], cover: 16, shots: [5], memo: '', steam: true, folder: 'NorthboundSignal' },
  { title: '종이비행기 클럽', developerId: 'dev-1', tags: ['힐링', '단편'], cover: null, shots: [], memo: '', folder: 'PaperPlaneClub' },
  { title: '静かな海の記録', developerId: 'dev-5', tags: ['탐색', '스토리', '일본어'], cover: 17, shots: [6, 7], memo: '', folder: 'RecordsOfAQuietSea' },
  { title: '반쯤 열린 문', developerId: 'dev-6', tags: ['호러', '단편'], cover: 18, shots: [8], memo: '', folder: 'HalfOpenDoor' },
  { title: 'Almanac of Small Weather', developerId: 'dev-3', tags: ['퍼즐', '힐링', '무료'], cover: 19, shots: [9, 10], memo: '', folder: 'AlmanacOfSmallWeather' },
  { title: '마지막 정거장', developerId: null, tags: [], cover: 20, shots: [], memo: '', folder: 'TheLastStop' },
  { title: '흐린 날의 지도', developerId: 'dev-4', tags: ['어드벤처', '탐색', '한글화'], cover: null, shots: [11], memo: '', folder: 'MapOfAnOvercastDay' }
]

const pad = (n: number) => String(n).padStart(2, '0')

// Spread createdAt so the "recent / oldest" sort has something to order by.
const createdAt = (i: number) =>
  new Date(Date.UTC(2025, 0, 1) + i * 9 * 86400000).toISOString()

export const buildPrograms = (): Program[] =>
  SEEDS.map((seed, i) => ({
    id: `prog-${pad(i + 1)}`,
    title: seed.title,
    executablePath: seed.steam
      ? `steam://run/${100000 + i}`
      : `D:\\Games\\${seed.folder}\\${seed.folder}.exe`,
    iconPath: null,
    thumbnailPath: seed.cover === null ? null : `covers/${pad(seed.cover)}.svg`,
    previewImages: seed.shots.map(s => `shots/${pad(s)}.svg`),
    marketUrl: seed.market ?? null,
    category: seed.steam ? 'steam' : 'local',
    developerId: seed.developerId,
    // Publisher shares the developer pool; the forms auto-fill one from the
    // other, so the seed mirrors that.
    publisherId: seed.publisherId ?? seed.developerId,
    tags: tagIds(seed.tags),
    keywords: seed.keywords ?? [],
    memo: seed.memo,
    createdAt: createdAt(i),
    updatedAt: createdAt(i)
  }))

export const buildLibrary = (): LibraryData => ({
  version: '1.0.0',
  programs: buildPrograms(),
  developers: DEVELOPERS,
  tags: TAGS
})
