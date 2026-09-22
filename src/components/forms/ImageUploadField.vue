<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageOff, Trash2, Upload } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import {
  getAttachmentConstraints,
  validateAttachment,
  type AttachmentConstraints,
} from '@/api/attachments.api'
import { useFormat } from '@/composables/useFormat'
import { resolveAssetUrl } from '@/utils/assets'

/**
 * Picks an image and hands the chosen `File` back to the form.
 *
 * Choosing a file makes no network request: the file is held in form state and
 * travels with the entity when the form is submitted, so creating a merchant
 * with a logo is one multipart request rather than an upload followed by a
 * create. The backend owns the attachment's creation and ownership, so nothing
 * here knows about attachment ids, owner types or owner ids.
 *
 * The preview is a local object URL for a newly chosen file, or the URL the
 * backend already returned for a saved image.
 */
const props = withDefaults(
  defineProps<{
    /** The chosen file, or null when nothing new has been picked. */
    modelValue: File | null
    /** The saved image's URL, shown until a new file replaces it. */
    existingUrl?: string | null
    label?: string
    hint?: string
    errors?: string[]
    disabled?: boolean
    /** Upload button text; defaults to "Upload image". */
    uploadLabel?: string
    /** Square icon-sized preview rather than a wide logo one. */
    compact?: boolean
  }>(),
  { modelValue: null, existingUrl: null, disabled: false, compact: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
  /**
   * True once the user has asked for the saved image to be removed, which the
   * form sends as `ClearLogo` / `ClearIcon`.
   */
  'update:cleared': [value: boolean]
}>()

const { t } = useI18n()
const fmt = useFormat()

const input = ref<HTMLInputElement | null>(null)
const localError = ref<string | null>(null)
/** Object URL for the chosen file. Owned here, so it is revoked here. */
const objectUrl = ref<string | null>(null)
/** True when the saved image was removed and no replacement chosen. */
const cleared = ref(false)

/**
 * The server's limits, fetched once and shared by every instance.
 *
 * Checking against them before submitting turns a 413 or 415 into a message
 * beside the field the moment a file is chosen. The server still validates.
 */
let constraintsPromise: Promise<AttachmentConstraints> | null = null
const constraints = ref<AttachmentConstraints | null>(null)

async function loadConstraints(): Promise<AttachmentConstraints | null> {
  constraintsPromise ??= getAttachmentConstraints()
  try {
    constraints.value = await constraintsPromise
    return constraints.value
  } catch {
    // Not fatal: the server enforces its own limits and its refusal is shown
    // against the field.
    constraintsPromise = null
    return null
  }
}

void loadConstraints()

/** Set when the saved image's URL could not be loaded by the browser. */
const previewFailed = ref(false)

/**
 * The chosen file's preview, else the saved image, unless it was removed.
 *
 * The saved image is resolved against the API origin; a local object URL is
 * already absolute and passes through untouched.
 */
const shownUrl = computed(() => {
  if (objectUrl.value) return objectUrl.value
  if (cleared.value || previewFailed.value) return null
  return resolveAssetUrl(props.existingUrl)
})
const hasImage = computed(() => Boolean(shownUrl.value))
const hasError = computed(() => Boolean(localError.value || props.errors?.length))
const firstError = computed(() => localError.value ?? props.errors?.[0])

const acceptTypes = computed(
  () => constraints.value?.allowedImageContentTypes.join(',') || 'image/*',
)

const sizeHint = computed(() => {
  const limit = constraints.value?.maxImageSizeBytes
  return limit ? fmt.bytes(limit) : null
})

function releaseObjectUrl(): void {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

// Revoked on unmount as well as on replacement, so a modal closed mid-edit does
// not leak the blob it was previewing.
onBeforeUnmount(releaseObjectUrl)

/**
 * Resets when the form is reopened for a different record.
 *
 * The parent clears `modelValue` on open; without this the previous record's
 * preview would survive into the next one.
 */
watch(
  () => props.modelValue,
  (file) => {
    if (file === null) {
      releaseObjectUrl()
      localError.value = null
    }
  },
)

watch(
  () => props.existingUrl,
  () => {
    cleared.value = false
    previewFailed.value = false
    emit('update:cleared', false)
  },
)

function choose(): void {
  if (props.disabled) return
  localError.value = null
  input.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  // Reset immediately so choosing the same file twice still fires a change.
  target.value = ''
  if (!file) return

  localError.value = null

  // Checked against the server's own rules rather than a hard-coded list, so the
  // two cannot drift.
  const limits = constraints.value ?? (await loadConstraints())
  if (limits) {
    const check = validateAttachment(file, limits)
    if (!check.valid) {
      localError.value = t(check.reason === 'size' ? 'upload.tooLarge' : 'upload.wrongType')
      return
    }
    if (check.kind !== 'Image') {
      localError.value = t('upload.wrongType')
      return
    }
  }

  releaseObjectUrl()
  objectUrl.value = URL.createObjectURL(file)

  // Choosing a replacement supersedes a pending removal, and a failure to load
  // the previous saved image must not suppress this one's preview.
  previewFailed.value = false
  cleared.value = false
  emit('update:cleared', false)
  emit('update:modelValue', file)
}

/**
 * Drops the image from the form.
 *
 * A newly chosen file is simply discarded. A saved image is marked for removal,
 * which the form sends as the server's `ClearLogo` / `ClearIcon` flag — nothing
 * is deleted until the form is saved.
 */
function remove(): void {
  if (props.disabled) return

  releaseObjectUrl()
  localError.value = null
  emit('update:modelValue', null)

  if (props.existingUrl) {
    cleared.value = true
    emit('update:cleared', true)
  }
}
</script>

<template>
  <div class="w-full">
    <p v-if="label" class="mb-1.5 block text-sm font-medium text-content">{{ label }}</p>

    <div class="flex items-start gap-3">
      <!-- Preview. `object-cover` keeps a non-square logo from stretching. -->
      <div
        class="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border
               border-hairline bg-surface-muted"
        :class="compact ? 'size-16' : 'size-20'"
      >
        <!--
          A saved image is fetched by the browser with no `Authorization`
          header, so it can fail with 401 or 404. Falling back to the empty
          state keeps the field usable — the user can still pick a new file.
        -->
        <img
          v-if="hasImage"
          :src="shownUrl!"
          alt=""
          class="size-full object-cover"
          @error="previewFailed = true"
        />
        <ImageOff v-else class="size-5 text-content-subtle" aria-hidden="true" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <BaseButton variant="secondary" size="sm" :disabled="disabled" @click="choose">
            <template #icon><Upload class="size-4" /></template>
            {{
              hasImage ? $t('common.replaceImage') : (uploadLabel ?? $t('common.upload'))
            }}
          </BaseButton>

          <BaseButton
            v-if="hasImage"
            variant="ghost"
            size="sm"
            :disabled="disabled"
            @click="remove"
          >
            <template #icon><Trash2 class="size-4" /></template>
            {{ $t('common.removeImage') }}
          </BaseButton>
        </div>

        <p v-if="hint && !hasError" class="mt-1.5 text-xs text-content-muted">{{ hint }}</p>
        <p v-if="!hasError && sizeHint" class="mt-1 text-xs text-content-subtle">
          {{ $t('upload.dropHint') }} · {{ sizeHint }}
        </p>
        <p v-if="hasError" class="mt-1.5 text-xs font-medium text-danger-600">{{ firstError }}</p>
      </div>
    </div>

    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="acceptTypes"
      :disabled="disabled"
      @change="onFileSelected"
    />
  </div>
</template>
