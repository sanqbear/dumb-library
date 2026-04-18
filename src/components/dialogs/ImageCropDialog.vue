<script setup lang="ts">
import { ref, watch, shallowRef } from 'vue'
import { NModal, NButton, NSpace, useMessage } from 'naive-ui'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

interface CropperResultLike {
  canvas?: HTMLCanvasElement
}

interface CropperApi {
  getResult: () => CropperResultLike
}

const props = defineProps<{
  show: boolean
  source: string          // data URL or wl-image URL
  aspectRatio: number     // width / height, e.g. 2/3 for thumbnail, 1 for icon
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  /**
   * Fired when the user confirms the crop. Payload is the absolute path to a
   * temp file holding the cropped bytes (PNG). Caller treats this like any
   * other selected source — the normal save pipeline will re-encode to webp.
   */
  (e: 'confirm', tempPath: string): void
}>()

const message = useMessage()

// shallowRef — Cropper instance holds DOM and reactivity isn't needed
const cropperRef = shallowRef<CropperApi | null>(null)
const isProcessing = ref(false)

// Reset the cropper instance whenever the dialog re-opens so stencil
// dimensions recalculate against the fresh source.
watch(() => props.show, (v) => {
  if (!v) {
    cropperRef.value = null
    isProcessing.value = false
  }
})

const handleConfirm = async () => {
  const cropper = cropperRef.value
  if (!cropper) {
    message.error('크롭 준비가 안 되었습니다')
    return
  }
  isProcessing.value = true
  try {
    const { canvas } = cropper.getResult()
    if (!canvas) {
      message.error('크롭 결과를 얻지 못했습니다')
      return
    }
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) {
      message.error('이미지 인코딩 실패')
      return
    }
    const arrayBuffer = await blob.arrayBuffer()
    const tempPath = await window.electron.writeTempImageBuffer(new Uint8Array(arrayBuffer))
    emit('confirm', tempPath)
    emit('update:show', false)
  } catch (error) {
    console.error('Crop failed:', error)
    message.error('크롭 처리 실패')
  } finally {
    isProcessing.value = false
  }
}

const handleCancel = () => {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="emit('update:show', $event)"
    preset="card"
    :title="title ?? '이미지 크롭'"
    :bordered="false"
    size="medium"
    :style="{ width: '640px' }"
    :mask-closable="false"
  >
    <div class="cropper-box">
      <Cropper
        v-if="show && source"
        ref="cropperRef"
        class="cropper"
        :src="source"
        :stencil-props="{ aspectRatio }"
        :auto-zoom="true"
        image-restriction="stencil"
      />
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCancel" :disabled="isProcessing">취소</NButton>
        <NButton
          type="primary"
          @click="handleConfirm"
          :loading="isProcessing"
          :disabled="isProcessing"
        >
          적용
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.cropper-box {
  height: 420px;
  background-color: #18181b;
  border-radius: 8px;
  overflow: hidden;
}

:global(.light-theme) .cropper-box {
  background-color: #27272a;
}

.cropper {
  height: 100%;
  width: 100%;
}
</style>
