<script setup lang="ts">
/**
 * The FiberX mark — the single place the logo is defined.
 *
 * The real artwork lives in two files and is picked by locale, because the lockups
 * are not mirror images of each other: the Latin one reads "fiber" then X, the
 * Arabic one leads with the X and sets فايبر beneath it.
 *
 *   src/assets/logo-fiberx.png     Latin "fiberX", used for en
 *   src/assets/logo-fiberx-ar.png  Arabic "فايبر X", used for ar
 *
 * Each has a -dark twin whose wordmark is white. They are the supplied artwork at
 * 2000×712 with transparency, so they sit on any ground and stay sharp well past
 * the ~32px the app renders them at.
 *
 * The drawn wordmark below is kept for one case the files cannot serve: a
 * single-colour rendering on a dark or coloured ground. An <img> cannot inherit
 * currentColor, so `monochrome` falls back to the inline SVG rather than shipping
 * a two-colour mark onto a ground it was never meant for.
 *
 * The wrapper never constrains both dimensions, so the aspect ratio is set by
 * the artwork and cannot be stretched by a caller.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui.store'

const props = withDefaults(
  defineProps<{
    /** Height in pixels; width follows from the artwork's own ratio. */
    height?: number
    /** Renders the wordmark in a single colour, for dark or coloured grounds. */
    monochrome?: boolean
    /**
     * The square X monogram instead of the full lockup, for somewhere too narrow
     * to fit a wordmark — the collapsed sidebar rail.
     */
    mark?: boolean
  }>(),
  { height: 32, monochrome: false, mark: false },
)

const { locale } = useI18n()
const ui = useUiStore()

const isArabic = computed(() => locale.value === 'ar')

/**
 * Four files: two lockups, each in a light and a dark variant.
 *
 * The dark ones differ only in the wordmark being white — the brand violet is
 * near-black against the dark surface and would all but disappear. The orange is
 * the same in both, because it reads on either ground.
 *
 * Resolved through `new URL(..., import.meta.url)` so Vite fingerprints each file
 * at build time; a runtime-assembled path would not be bundled at all.
 */
const assetUrl = computed(() => {
  const file = isArabic.value
    ? ui.isDark
      ? new URL('../../assets/logo-fiberx-ar-dark.png', import.meta.url)
      : new URL('../../assets/logo-fiberx-ar.png', import.meta.url)
    : ui.isDark
      ? new URL('../../assets/logo-fiberx-dark.png', import.meta.url)
      : new URL('../../assets/logo-fiberx.png', import.meta.url)

  return file.href
})

/** The brand name as written in the current language, for assistive tech. */
const label = computed(() => (isArabic.value ? 'فايبر إكس' : 'FiberX'))

/**
 * The square monogram: the X alone on the brand violet, already drawn for
 * exactly this problem — too little room for a wordmark. Served from `public/`,
 * so it is referenced by absolute path rather than through `new URL`.
 *
 * This is the 16px tab icon, not `favicon-lockup.png`, which carries the full
 * wordmark for the larger sizes. The rail renders at 26px, where the word would
 * be an illegible smear, so it takes the monogram.
 *
 * The monogram carries its own violet ground, so it needs no light and dark
 * twin the way the lockups do.
 */
const MONOGRAM_SRC = '/favicon.png'

// The artwork carries its own two colours, so it can only be used where those
// colours are wanted. Monochrome asks for the opposite and gets the drawn mark.
const useArtwork = computed(() => !props.monochrome)

const violet = computed(() => (props.monochrome ? 'currentColor' : '#4A2B8C'))
const orange = computed(() => (props.monochrome ? 'currentColor' : '#F26B3E'))
</script>

<template>
  <!--
    The monogram is square, so both dimensions are set from `height` rather than
    letting the width follow the artwork as the lockup does. Rounded to match the
    icon's own corners.
  -->
  <img
    v-if="mark"
    :src="MONOGRAM_SRC"
    :style="{ height: `${height}px`, width: `${height}px` }"
    :alt="label"
    class="block select-none rounded-lg"
    draggable="false"
  />

  <img
    v-else-if="useArtwork"
    :src="assetUrl"
    :style="{ height: `${height}px`, width: 'auto' }"
    :alt="label"
    class="block select-none"
    draggable="false"
  />

  <!--
    Single-colour fallback, for a dark or coloured ground where the two-colour
    artwork would not read. Drawn at a fixed intrinsic size and scaled by height
    alone, so the ratio is fixed by the mark and a caller cannot stretch it.
    `overflow-visible` keeps the glyphs from being clipped by the viewBox when
    the surrounding column is narrow.
  -->
  <svg
    v-else
    :style="{ height: `${height}px`, width: 'auto' }"
    viewBox="0 0 132 34"
    class="block select-none overflow-visible"
    role="img"
    :aria-label="label"
  >
    <title>{{ label }}</title>
    <text
      x="0"
      y="25"
      font-family="Inter, system-ui, sans-serif"
      font-size="26"
      font-weight="700"
      letter-spacing="-1"
      :fill="violet"
      :class="monochrome ? 'fill-current' : 'dark:fill-white'"
    >
      fiber
    </text>
    <path
      d="M84 5h12l6.3 9.3L108.6 5H120l-11.6 16 11.6 13h-12l-6.5-9.7L96 34H84l11.8-12z"
      :fill="orange"
    />
  </svg>
</template>
