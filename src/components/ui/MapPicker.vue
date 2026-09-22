<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, LocateFixed } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

/**
 * Click-to-place coordinate picker over OpenStreetMap tiles.
 *
 * Latitude and longitude stay strings, as the branches API stores them, so a
 * value typed by hand or returned by the backend round-trips untouched until
 * the user actually moves the pin. Only a pin move rewrites them, and then to a
 * fixed precision — about 10cm, far finer than a branch needs.
 */
const props = withDefaults(
  defineProps<{
    latitude: string
    longitude: string
    /** Where to centre when neither coordinate is set yet. Defaults to Baghdad. */
    fallbackCenter?: [number, number]
    label?: string
    hint?: string
    disabled?: boolean
  }>(),
  { fallbackCenter: () => [33.3152, 44.3661], disabled: false },
)

const emit = defineEmits<{ 'update:latitude': [string]; 'update:longitude': [string] }>()

const { t } = useI18n()

const COORD_PRECISION = 6
const PLACED_ZOOM = 15
const EMPTY_ZOOM = 11

const host = ref<HTMLDivElement | null>(null)
// Leaflet instances are deeply mutable and must not be made reactive proxies —
// Vue's reactivity interferes with its internal identity checks.
const map = shallowRef<L.Map | null>(null)
const marker = shallowRef<L.Marker | null>(null)

let resizeObserver: ResizeObserver | null = null

const locating = ref(false)
const locateError = ref<string | null>(null)

/** The current pair as numbers, or null while either side is blank or unparseable. */
const position = computed<[number, number] | null>(() => {
  const lat = Number(props.latitude)
  const lng = Number(props.longitude)
  if (props.latitude.trim() === '' || props.longitude.trim() === '') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
})

/** A pin icon built from inline SVG, so no image assets need bundling. */
const pinIcon = L.divIcon({
  className: 'map-picker-pin',
  html: `<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path d="M12 0C7.03 0 3 4.03 3 9c0 6.3 8.06 14.4 8.4 14.74a.83.83 0 0 0 1.2 0C12.94 23.4 21 15.3 21 9c0-4.97-4.03-9-9-9Z" fill="currentColor"/>
      <circle cx="12" cy="9" r="3.2" fill="#fff"/>
    </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
})

function writePosition(lat: number, lng: number): void {
  emit('update:latitude', lat.toFixed(COORD_PRECISION))
  emit('update:longitude', lng.toFixed(COORD_PRECISION))
}

/** Places or moves the pin without recentring; the caller decides about the view. */
function drawMarker(at: [number, number]): void {
  if (!map.value) return

  if (marker.value) {
    marker.value.setLatLng(at)
    return
  }

  marker.value = L.marker(at, {
    icon: pinIcon,
    draggable: !props.disabled,
    keyboard: true,
    title: t('map.pinTitle'),
  })
    .on('dragend', () => {
      const moved = marker.value?.getLatLng()
      if (moved) writePosition(moved.lat, moved.lng)
    })
    .addTo(map.value)
}

function removeMarker(): void {
  marker.value?.remove()
  marker.value = null
}

onMounted(() => {
  if (!host.value) return

  const start = position.value
  map.value = L.map(host.value, {
    center: start ?? props.fallbackCenter,
    zoom: start ? PLACED_ZOOM : EMPTY_ZOOM,
    // The picker lives inside a scrollable modal, so the wheel must keep
    // scrolling the form. Ctrl+wheel and the +/- buttons still zoom.
    scrollWheelZoom: false,
    zoomControl: !props.disabled,
    attributionControl: true,
  })

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map.value)

  if (start) drawMarker(start)

  if (!props.disabled) {
    map.value.on('click', (event: L.LeafletMouseEvent) => {
      writePosition(event.latlng.lat, event.latlng.lng)
    })
  }

  // The picker opens inside a modal that scales in over 200ms, so the container
  // has no final size on mount and Leaflet would render a single tile against a
  // stale viewport. Observing the element catches the settled size whenever it
  // changes — after the transition, and on any later resize.
  resizeObserver = new ResizeObserver(() => map.value?.invalidateSize())
  resizeObserver.observe(host.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map.value?.remove()
  map.value = null
  marker.value = null
})

/**
 * Typing in the latitude/longitude inputs moves the pin.
 *
 * The view only follows when the point is off-screen, so tweaking a digit does
 * not yank a map the user has just panned somewhere deliberate.
 */
watch(position, (next) => {
  if (!map.value) return

  if (!next) {
    removeMarker()
    return
  }

  const hadMarker = marker.value !== null
  drawMarker(next)

  if (!hadMarker) {
    map.value.setView(next, Math.max(map.value.getZoom(), PLACED_ZOOM))
  } else if (!map.value.getBounds().contains(next)) {
    map.value.panTo(next)
  }
})

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled) marker.value?.dragging?.disable()
    else marker.value?.dragging?.enable()
  },
)

/** Centres on the device's own location and drops the pin there. */
function locateMe(): void {
  if (props.disabled || locating.value) return

  locateError.value = null

  if (!navigator.geolocation) {
    locateError.value = t('map.locateUnsupported')
    return
  }

  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (found) => {
      locating.value = false
      writePosition(found.coords.latitude, found.coords.longitude)
      map.value?.setView([found.coords.latitude, found.coords.longitude], PLACED_ZOOM)
    },
    () => {
      locating.value = false
      locateError.value = t('map.locateFailed')
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  )
}

/** Brings the map back to the pin the form already holds. */
function recentre(): void {
  if (position.value) map.value?.setView(position.value, PLACED_ZOOM)
}
</script>

<template>
  <div class="w-full">
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <span v-if="label" class="block text-sm font-medium text-content">{{ label }}</span>

      <div class="flex items-center gap-1.5">
        <BaseButton
          v-if="!disabled"
          type="button"
          variant="ghost"
          size="sm"
          :disabled="!position"
          @click="recentre"
        >
          <template #icon><Crosshair class="size-4" /></template>
          {{ t('map.recentre') }}
        </BaseButton>
        <BaseButton
          v-if="!disabled"
          type="button"
          variant="ghost"
          size="sm"
          :loading="locating"
          @click="locateMe"
        >
          <template #icon><LocateFixed class="size-4" /></template>
          {{ t('map.useMyLocation') }}
        </BaseButton>
      </div>
    </div>

    <!--
      The map is decorative for a screen-reader user: the latitude and longitude
      inputs remain the accessible way to set a location, so the canvas is
      hidden from the tree rather than being made a fake control.
    -->
    <div
      ref="host"
      dir="ltr"
      aria-hidden="true"
      class="map-picker h-64 w-full overflow-hidden rounded-lg border border-hairline"
      :class="disabled ? 'pointer-events-none opacity-60' : ''"
    />

    <p v-if="locateError" class="mt-1.5 text-xs font-medium text-danger-600">{{ locateError }}</p>
    <p v-else class="mt-1.5 text-xs text-content-muted">
      {{ hint ?? t('map.pickHint') }}
    </p>
  </div>
</template>

<style>
/*
 * Not scoped: Leaflet builds its panes and controls outside the component's
 * own template, so a scoped attribute would never reach them.
 */
.map-picker .leaflet-container {
  height: 100%;
  width: 100%;
  background: rgb(var(--c-surface-muted));
  font: inherit;
  outline: none;
}

/* The brand violet (primary-600) is a literal in the Tailwind palette, not a
   CSS variable, so the pin names it directly. */
.map-picker .map-picker-pin {
  color: #4a2b8c;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.35));
}

/* The inverted tiles in dark mode wash out the dark violet, so the pin
   switches to the lighter step that still reads as the brand colour. */
.dark .map-picker .map-picker-pin {
  color: #8468c9;
}

.map-picker .leaflet-bar a,
.map-picker .leaflet-control-attribution {
  background-color: rgb(var(--c-surface));
  color: rgb(var(--c-text-muted));
  border-color: rgb(var(--c-border));
}

.map-picker .leaflet-bar a:hover {
  background-color: rgb(var(--c-surface-muted));
  color: rgb(var(--c-text));
}

.map-picker .leaflet-control-attribution a {
  color: rgb(var(--c-text-muted));
}

/* OSM tiles are drawn for a light background; this keeps them legible in dark. */
.dark .map-picker .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9);
}
</style>
