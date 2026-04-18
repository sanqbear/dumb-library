import { ref } from 'vue'

/**
 * Shared helpers for accepting image sources from:
 * - OS drag & drop (returns absolute path via webUtils.getPathForFile)
 * - http(s) URL input (delegates to main process to download into a temp file)
 *
 * Both flows return an absolute path the caller can assign to their image ref
 * (e.g. `thumbnailPath.value = path`) — the same contract as the OS file picker.
 */

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']

const isImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  return IMAGE_EXTENSIONS.includes(ext)
}

export const useImageInput = () => {
  const isDragOver = ref(false)
  const isFetching = ref(false)

  const onDragEnter = (e: DragEvent): void => {
    e.preventDefault()
    if (e.dataTransfer?.types.includes('Files')) {
      isDragOver.value = true
    }
  }

  const onDragOver = (e: DragEvent): void => {
    e.preventDefault()
  }

  const onDragLeave = (e: DragEvent): void => {
    e.preventDefault()
    isDragOver.value = false
  }

  /**
   * Handle a drop event. Returns the absolute path of the first dropped image
   * (or null if nothing droppable).
   */
  const onDrop = (e: DragEvent): string | null => {
    e.preventDefault()
    isDragOver.value = false
    const file = e.dataTransfer?.files?.[0]
    if (!file || !isImageFile(file)) return null
    const absPath = window.electron.getPathForFile(file)
    return absPath || null
  }

  /**
   * Fetch an image from a URL via the main process. Returns a temp file path
   * on success, null on any failure (invalid URL, non-image, size, timeout).
   */
  const fetchFromUrl = async (url: string): Promise<string | null> => {
    const trimmed = url.trim()
    if (!trimmed) return null
    isFetching.value = true
    try {
      return await window.electron.fetchImageFromUrl(trimmed)
    } finally {
      isFetching.value = false
    }
  }

  return {
    isDragOver,
    isFetching,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    fetchFromUrl
  }
}
