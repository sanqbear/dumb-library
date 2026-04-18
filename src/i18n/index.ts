import { createI18n } from 'vue-i18n'
import ko from './locales/ko'
import en from './locales/en'
import ja from './locales/ja'
import zhCN from './locales/zh-CN'

export type LocaleCode = 'ko' | 'en' | 'ja' | 'zh-CN'

export const SUPPORTED_LOCALES: LocaleCode[] = ['ko', 'en', 'ja', 'zh-CN']

export const LOCALE_META: Record<LocaleCode, { nativeName: string; englishName: string }> = {
  ko: { nativeName: '한국어', englishName: 'Korean' },
  en: { nativeName: 'English', englishName: 'English' },
  ja: { nativeName: '日本語', englishName: 'Japanese' },
  'zh-CN': { nativeName: '中文 (简体)', englishName: 'Simplified Chinese' }
}

export const isLocaleCode = (value: unknown): value is LocaleCode => {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value)
}

/**
 * Detect the best initial locale from the OS/browser preference.
 * Returns 'ko' when the system language isn't one of our supported locales,
 * matching the project's primary language.
 */
export const detectInitialLocale = (): LocaleCode => {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase()
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  if (lang.startsWith('zh')) return 'zh-CN'
  if (lang.startsWith('en')) return 'en'
  return 'ko'
}

export const i18n = createI18n({
  legacy: false,
  locale: 'ko',
  fallbackLocale: 'en',
  messages: {
    ko,
    en,
    ja,
    'zh-CN': zhCN
  }
})
