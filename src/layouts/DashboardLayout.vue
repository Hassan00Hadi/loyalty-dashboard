<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import BrandLogo from '@/components/layout/BrandLogo.vue'
import SidebarNav from '@/components/layout/SidebarNav.vue'
import BaseDrawer from '@/components/ui/BaseDrawer.vue'
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue'
import { useUiStore } from '@/stores/ui.store'

/**
 * The authenticated shell: a fixed sidebar from `lg` up, a drawer below it, and
 * a scrolling content column.
 *
 * The sidebar is placed by document order and `dir`, not by a left/right class,
 * so it sits at the inline start — left in English, right in Arabic — with no
 * conditional layout code.
 */
const ui = useUiStore()
const route = useRoute()
const { t } = useI18n()

const sidebarWidth = computed(() => (ui.sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'))

// Keeps the document title in step with the route, in the active language.
watch(
  [() => route.meta.titleKey, () => ui.locale],
  ([titleKey]) => {
    const pageName = titleKey ? t(titleKey as string) : null
    document.title = pageName ? `${pageName} · ${t('app.name')}` : t('app.name')
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-screen bg-canvas">
    <a
      href="#main-content"
      class="sr-only-focusable fixed top-2 z-[70] rounded-lg bg-primary-600 px-3 py-2 text-sm
             font-medium text-white shadow-raised start-2"
    >
      {{ $t('a11y.skipToContent') }}
    </a>

    <!--
      Desktop sidebar, pinned to the viewport.

      `sticky top-0` with `h-screen` rather than `fixed`: the aside keeps its place in
      the flex row, so the main column still shrinks around it and no margin has to be
      kept in sync with the collapsed width — which would also have to flip sides in
      Arabic. The fixed height is what finally gives `overflow-y-auto` below something
      to scroll, so a long nav scrolls inside the rail instead of pushing the footer
      off-screen.
    -->
    <aside
      class="sticky top-0 z-30 hidden h-screen shrink-0 border-e border-hairline bg-surface
             transition-all lg:flex lg:flex-col"
      :class="sidebarWidth"
    >
      <div
        class="flex h-14 shrink-0 items-center overflow-hidden border-b border-hairline px-3"
        :class="ui.sidebarCollapsed ? 'justify-center' : ''"
      >
        <RouterLink
          :to="{ name: 'dashboard' }"
          class="flex min-w-0 items-center rounded-lg p-1 transition hover:opacity-80"
          :aria-label="$t('app.name')"
        >
          <!--
            The collapsed rail is only 4rem wide, which the full lockup cannot
            fit, so it shows the monogram instead of a clipped wordmark.
          -->
          <BrandLogo v-if="!ui.sidebarCollapsed" :height="22" />
          <BrandLogo v-else mark :height="26" />
        </RouterLink>
      </div>

      <div class="flex-1 overflow-y-auto">
        <SidebarNav :collapsed="ui.sidebarCollapsed" />
      </div>

      <div
        v-if="!ui.sidebarCollapsed"
        class="shrink-0 border-t border-hairline px-4 py-3 text-[0.6875rem] text-content-subtle"
      >
        {{ $t('app.tagline') }}
      </div>
    </aside>

    <!-- Mobile drawer: anchored to the inline start so it mirrors in Arabic. -->
    <BaseDrawer :open="ui.mobileNavOpen" side="start" @close="ui.closeMobileNav()">
      <template #header>
        <BrandLogo :height="24" />
      </template>
      <SidebarNav @navigate="ui.closeMobileNav()" />
    </BaseDrawer>

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader />

      <main id="main-content" class="flex-1 px-4 py-5 sm:px-6 sm:py-6 2xl:px-10">
        <div class="mx-auto w-full max-w-[1600px]">
          <!-- Keyed on the route so a page transition replays per navigation. -->
          <RouterView v-slot="{ Component }">
            <Transition
              mode="out-in"
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              leave-active-class="transition duration-75 ease-in"
              leave-to-class="opacity-0"
            >
              <component :is="Component" :key="route.path" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>

    <BaseConfirmDialog />
  </div>
</template>
