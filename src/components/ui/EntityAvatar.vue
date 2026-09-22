<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveAssetUrl } from '@/utils/assets'

/**
 * An entity's picture, with a letter placeholder when there is none.
 *
 * A URL that fails to load falls back to the same placeholder rather than
 * leaving a broken image. That matters here because an image is fetched by the
 * browser directly, with no `Authorization` header and no way to add one — so a
 * URL can fail for reasons the dashboard cannot see or fix at the point of use:
 * the attachment may have been deleted (404), or the endpoint may refuse an
 * unauthenticated read (401).
 *
 * Used for merchant logos, category icons and tier icons, which were three
 * copies of this markup.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null
    /** Supplies the placeholder's letter, and the alt text. */
    name?: string | null
    /** Tailwind size class, e.g. `size-8`. */
    size?: string
    rounded?: string
  }>(),
  { src: null, name: null, size: 'size-8', rounded: 'rounded-lg' },
)

/** Set when the browser could not load this URL; reset when the URL changes. */
const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

/**
 * The API returns a relative URL, which an `<img>` would otherwise resolve
 * against the dashboard's own origin rather than the API's.
 */
const resolvedSrc = computed(() => resolveAssetUrl(props.src))

const showImage = computed(() => Boolean(resolvedSrc.value) && !failed.value)

const initial = computed(() => props.name?.trim().charAt(0).toUpperCase() || '—')
</script>

<template>
  <img
    v-if="showImage"
    :src="resolvedSrc!"
    :alt="name ?? ''"
    class="shrink-0 object-cover"
    :class="[size, rounded]"
    loading="lazy"
    @error="failed = true"
  />
  <div
    v-else
    class="flex shrink-0 items-center justify-center bg-surface-muted text-xs font-semibold
           text-content-subtle"
    :class="[size, rounded]"
    aria-hidden="true"
  >
    {{ initial }}
  </div>
</template>
