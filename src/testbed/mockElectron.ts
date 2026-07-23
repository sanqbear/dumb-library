/**
 * Browser stand-in for the preload `window.electron` bridge.
 *
 * Implements the whole ElectronAPI surface against localStorage and the
 * generated placeholder art under `public/testbed/`, so the renderer can run
 * in a plain browser tab for design review. Anything that needs the OS —
 * launching a program, revealing it in Explorer, extracting an icon — resolves
 * to a no-op and logs, rather than pretending to have succeeded.
 *
 * Installed by `src/testbed/main.ts` before the app entry is imported.
 */
import type {
  CreateDeveloperData,
  CreateProgramData,
  CreateSteamProgramData,
  Developer,
  ElectronAPI,
  LibraryData,
  Program,
  Settings,
  SteamGame,
  Tag,
  CreateTagData,
  UpdateTagData,
  UpdateDeveloperData
} from '../types'
import { setLibImageBase } from '../types'
import { buildLibrary } from './fixtures'

const LIB_KEY = 'testbed:library'
const SET_KEY = 'testbed:settings'

/** Library images are served from `testbed-assets/lib/`, mirroring wl-image://lib/. */
export const LIB_IMAGE_BASE = '/lib/'

const log = (label: string, ...rest: unknown[]) =>
  console.info(`%c[testbed] ${label}`, 'color:#ab4aba;font-weight:600', ...rest)

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`

const now = () => new Date().toISOString()

// ---------------------------------------------------------------- persistence

const readLibrary = (): LibraryData => {
  const raw = localStorage.getItem(LIB_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as LibraryData
    } catch {
      log('저장된 라이브러리를 읽지 못해 초기 데이터로 되돌립니다')
    }
  }
  const seeded = buildLibrary()
  localStorage.setItem(LIB_KEY, JSON.stringify(seeded))
  return seeded
}

let library: LibraryData = readLibrary()

const persist = () => localStorage.setItem(LIB_KEY, JSON.stringify(library))

/** Wipe testbed state so the next load starts from the seed fixtures. */
export const resetTestbedData = (): void => {
  localStorage.removeItem(LIB_KEY)
  localStorage.removeItem(SET_KEY)
}

// ------------------------------------------------------------- image plumbing

// Files picked or dropped in the browser have no real path, so we hand out
// `testbed://` tokens and keep the bytes here for readImageAsDataUrl().
const blobs = new Map<string, Blob>()
let tokenSeq = 0

const token = (): string => `testbed://blob/${++tokenSeq}`

const toDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const COVERS = Array.from({ length: 20 }, (_, i) => `covers/${String(i + 1).padStart(2, '0')}.svg`)
const SHOTS = Array.from({ length: 12 }, (_, i) => `shots/${String(i + 1).padStart(2, '0')}.svg`)
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T

/** Fetch one of the bundled placeholders as a data URL. */
const placeholderDataUrl = async (rel: string): Promise<string | null> => {
  try {
    const res = await fetch(`${LIB_IMAGE_BASE}${rel}`)
    return await toDataUrl(await res.blob())
  } catch {
    return null
  }
}

// --------------------------------------------------------------- window frame

// The app runs inside an iframe; the shell page owns the real window frame.
type MaximizeListener = (value: boolean) => void
const maximizeListeners = new Set<MaximizeListener>()
let maximized = false

const postToShell = (action: string) => {
  window.parent?.postMessage({ source: 'waifu-testbed', action }, '*')
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { source?: string; type?: string; value?: boolean } | null
  if (!data || data.source !== 'waifu-testbed-shell') return
  if (data.type === 'maximized') {
    maximized = Boolean(data.value)
    maximizeListeners.forEach(fn => fn(maximized))
  }
})

// ------------------------------------------------------------------- programs

const findProgram = (id: string): Program | undefined =>
  library.programs.find(p => p.id === id)

const patchListeners = new Set<(payload: { id: string; changes: Partial<Program> }) => void>()

const patchProgram = (id: string, changes: Partial<Program>) => {
  const program = findProgram(id)
  if (!program) return
  Object.assign(program, changes, { updatedAt: now() })
  persist()
  patchListeners.forEach(fn => fn({ id, changes }))
}

const newProgram = (data: CreateProgramData, category: 'local' | 'steam'): Program => ({
  id: uid('prog'),
  title: data.title,
  executablePath: data.executablePath,
  iconPath: null,
  thumbnailPath: null,
  previewImages: [],
  marketUrl: data.marketUrl ?? null,
  category,
  developerId: data.developerId ?? null,
  publisherId: data.publisherId ?? data.developerId ?? null,
  tags: data.tags ?? [],
  keywords: data.keywords ?? [],
  memo: data.memo ?? '',
  createdAt: now(),
  updatedAt: now()
})

// ------------------------------------------------------------------------ API

const api: ElectronAPI = {
  loadLibrary: async () => {
    await delay(120) // let the loading spinner actually show
    return JSON.parse(JSON.stringify(library)) as LibraryData
  },
  saveLibrary: async (data) => {
    library = data
    persist()
  },

  addProgram: async (data) => {
    const program = newProgram(data, 'local')
    library.programs.push(program)
    persist()
    return program
  },
  updateProgram: async (data) => {
    const program = findProgram(data.id)
    if (!program) throw new Error(`알 수 없는 프로그램: ${data.id}`)
    const { id: _id, ...rest } = data
    Object.assign(program, rest, { updatedAt: now() })
    persist()
    return { ...program }
  },
  deleteProgram: async (id) => {
    library.programs = library.programs.filter(p => p.id !== id)
    persist()
  },

  addDeveloper: async (data: CreateDeveloperData) => {
    const developer: Developer = {
      id: uid('dev'),
      names: data.names,
      createdAt: now(),
      updatedAt: now()
    }
    library.developers.push(developer)
    persist()
    return developer
  },
  updateDeveloper: async (data: UpdateDeveloperData) => {
    const developer = library.developers.find(d => d.id === data.id)
    if (!developer) throw new Error(`알 수 없는 서클: ${data.id}`)
    developer.names = data.names
    developer.updatedAt = now()
    persist()
    return { ...developer }
  },
  deleteDeveloper: async (id) => {
    library.developers = library.developers.filter(d => d.id !== id)
    library.programs.forEach(p => {
      if (p.developerId === id) p.developerId = null
      if (p.publisherId === id) p.publisherId = null
    })
    persist()
  },

  addTag: async (data: CreateTagData) => {
    const tag: Tag = {
      id: uid('tag'),
      names: data.names,
      keyword: data.keyword ?? '',
      createdAt: now(),
      updatedAt: now()
    }
    library.tags.push(tag)
    persist()
    return tag
  },
  updateTag: async (data: UpdateTagData) => {
    const tag = library.tags.find(x => x.id === data.id)
    if (!tag) throw new Error(`알 수 없는 태그: ${data.id}`)
    tag.names = data.names
    if (data.keyword !== undefined) tag.keyword = data.keyword
    tag.updatedAt = now()
    persist()
    return { ...tag }
  },
  deleteTag: async (id) => {
    library.tags = library.tags.filter(t => t.id !== id)
    library.programs.forEach(p => {
      p.tags = p.tags.filter(t => t !== id)
    })
    persist()
  },

  onProgramPatched: (callback) => {
    patchListeners.add(callback)
    return () => patchListeners.delete(callback)
  },

  launchProgram: async (executablePath) => {
    log('실행 (브라우저에서는 동작하지 않음):', executablePath)
  },
  revealProgram: async (executablePath) => {
    log('탐색기에서 보기 (브라우저에서는 동작하지 않음):', executablePath)
  },
  openExternal: async (url) => {
    window.open(url, '_blank', 'noopener')
    return true
  },

  selectExecutable: async () => {
    const value = window.prompt('실행 파일 경로를 입력하세요 (테스트베드)', 'D:\\Games\\Sample\\game.exe')
    return value && value.trim() ? value.trim() : null
  },
  selectImage: async () =>
    new Promise<string | null>(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const key = token()
        blobs.set(key, file)
        resolve(key)
      }
      // A cancelled picker fires no event in some browsers; resolve on blur.
      input.oncancel = () => resolve(null)
      input.click()
    }),

  saveThumbnail: async (programId, imagePath) => {
    // Real main resizes and writes the file; here we adopt a placeholder so the
    // grid visibly changes, and note which source it stood in for.
    const rel = pick(COVERS)
    log('썸네일 저장 — 플레이스홀더로 대체:', imagePath, '→', rel)
    patchProgram(programId, { thumbnailPath: rel })
    return rel
  },
  deleteThumbnail: async (programId) => {
    patchProgram(programId, { thumbnailPath: null })
  },

  savePreviewImage: async (programId, imagePath) => {
    const rel = pick(SHOTS)
    log('프리뷰 저장 — 플레이스홀더로 대체:', imagePath, '→', rel)
    const program = findProgram(programId)
    if (program) patchProgram(programId, { previewImages: [...program.previewImages, rel] })
    return rel
  },
  deletePreviewImage: async (programId, relPath) => {
    const program = findProgram(programId)
    if (program) {
      patchProgram(programId, { previewImages: program.previewImages.filter(p => p !== relPath) })
    }
  },
  reorderPreviewImages: async (programId, relPaths) => {
    patchProgram(programId, { previewImages: [...relPaths] })
  },

  extractIcon: async (executablePath) => {
    log('아이콘 추출은 테스트베드에서 지원하지 않습니다:', executablePath)
    return null
  },
  saveIcon: async (programId, imagePath) => {
    const rel = pick(COVERS)
    log('아이콘 저장 — 플레이스홀더로 대체:', imagePath, '→', rel)
    patchProgram(programId, { iconPath: rel })
    return rel
  },
  deleteIcon: async (programId) => {
    patchProgram(programId, { iconPath: null })
  },

  loadSettings: async () => {
    const raw = localStorage.getItem(SET_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as Settings
      } catch {
        /* fall through to defaults */
      }
    }
    return { theme: 'dark', viewMode: 'grid', language: 'ko', gridCardSize: 'medium' }
  },
  saveSettings: async (settings) => {
    localStorage.setItem(SET_KEY, JSON.stringify(settings))
  },

  getAssetPath: async (relativePath) => `${LIB_IMAGE_BASE}${relativePath}`,
  readImageAsDataUrl: async (absPath) => {
    const blob = blobs.get(absPath)
    if (blob) return toDataUrl(blob)
    if (absPath.startsWith(LIB_IMAGE_BASE)) return placeholderDataUrl(absPath.slice(LIB_IMAGE_BASE.length))
    return placeholderDataUrl(pick(COVERS))
  },
  fetchImageFromUrl: async (url) => {
    // Arbitrary remote fetches are blocked by CORS in a browser tab, so this
    // stands in a placeholder rather than failing the flow under test.
    log('URL에서 이미지 가져오기 — 플레이스홀더로 대체:', url)
    return placeholderDataUrl(pick(COVERS))
  },
  writeTempImageBuffer: async (data) => {
    const key = token()
    blobs.set(key, new Blob([data as unknown as BlobPart], { type: 'image/png' }))
    return key
  },
  getPathForFile: (file) => {
    const key = token()
    blobs.set(key, file)
    return key
  },

  windowMinimize: async () => postToShell('minimize'),
  windowMaximize: async () => postToShell('maximize'),
  windowClose: async () => postToShell('close'),
  windowIsMaximized: async () => maximized,
  onWindowMaximizeChanged: (callback) => {
    maximizeListeners.add(callback)
    return () => maximizeListeners.delete(callback)
  },

  scanSteamGames: async () => {
    await delay(400)
    const games: SteamGame[] = [
      { appId: 220, name: 'Sample Half Note', installDir: 'D:\\Steam\\common\\SampleA' },
      { appId: 400, name: 'Portal Sample', installDir: 'D:\\Steam\\common\\SampleB' },
      { appId: 620, name: 'Sample Episode Two', installDir: 'D:\\Steam\\common\\SampleC' },
      { appId: 730, name: 'Sample Strike', installDir: 'D:\\Steam\\common\\SampleD' }
    ]
    return games
  },
  addSteamPrograms: async (entries: CreateSteamProgramData[]) => {
    const created = entries.map(entry =>
      newProgram(
        { title: entry.name, executablePath: `steam://run/${entry.appId}` },
        'steam'
      )
    )
    library.programs.push(...created)
    persist()
    // Mirror the real flow: the thumbnail lands a moment later via a patch push.
    created.forEach((program, i) => {
      void delay(600 + i * 250).then(() => patchProgram(program.id, { thumbnailPath: pick(COVERS) }))
    })
    return created
  },
  downloadSteamThumbnail: async (programId) => {
    await delay(500)
    const rel = pick(COVERS)
    patchProgram(programId, { thumbnailPath: rel })
    return rel
  },
  applySteamCachedIcon: async () => null
}

/** Install the mock bridge. Safe to call once, before the app entry loads. */
export const installMockElectron = (): void => {
  setLibImageBase(LIB_IMAGE_BASE)
  window.electron = api
  log('mock bridge 설치됨 — 프로그램', library.programs.length, '개')
}
