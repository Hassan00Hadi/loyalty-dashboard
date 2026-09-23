import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { P } from '@/utils/permissions'

/**
 * Route meta contract.
 *
 * `anyPermission` is used rather than a single value because most pages are
 * reachable with any one of several reads — the offers screen, for example,
 * needs `Offers.Read` but the merchant filter is a bonus, not a requirement.
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** Page title i18n key, shown in the document title. */
        titleKey?: string
    breadcrumb?: string
    /** Reachable without a session. */
    public?: boolean
    /** Caller must hold at least one of these. */
    anyPermission?: string[]
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true, titleKey: 'auth.signIn' },
  },

  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { breadcrumb: 'nav.dashboard' },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { titleKey: 'dashboard.title' },
      },

      // ── Loyalty ───────────────────────────────────────────────────────────
      {
        path: 'wallets',
        name: 'wallets',
        component: () => import('@/pages/WalletsPage.vue'),
        meta: {
          titleKey: 'wallets.title',
          breadcrumb: 'wallets.title',
          anyPermission: [P.UserPointsRead],
        },
      },
      {
        path: 'wallets/:userId',
        name: 'wallet-detail',
        component: () => import('@/pages/WalletDetailPage.vue'),
        meta: {
          titleKey: 'wallets.detailTitle',
          breadcrumb: 'wallets.detailTitle',
          anyPermission: [P.UserPointsRead],
        },
      },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/pages/TransactionsPage.vue'),
        meta: {
          titleKey: 'transactions.title',
          breadcrumb: 'transactions.title',
          anyPermission: [P.UserPointsRead],
        },
      },
      {
        path: 'tiers',
        name: 'tiers',
        component: () => import('@/pages/TiersPage.vue'),
        meta: {
          titleKey: 'tiers.title',
          breadcrumb: 'tiers.title',
          anyPermission: [P.MembershipTiersRead],
        },
      },
      {
        path: 'categories',
        name: 'categories',
        component: () => import('@/pages/CategoriesPage.vue'),
        meta: {
          titleKey: 'categories.title',
          breadcrumb: 'categories.title',
          anyPermission: [P.CategoriesRead],
        },
      },
      {
        path: 'merchants',
        name: 'merchants',
        component: () => import('@/pages/MerchantsPage.vue'),
        meta: {
          titleKey: 'merchants.title',
          breadcrumb: 'merchants.title',
          anyPermission: [P.MerchantsRead],
        },
      },
      {
        path: 'branches',
        name: 'branches',
        component: () => import('@/pages/BranchesPage.vue'),
        meta: {
          titleKey: 'branches.title',
          breadcrumb: 'branches.title',
          anyPermission: [P.BranchesRead],
        },
      },
      {
        path: 'cities',
        name: 'cities',
        component: () => import('@/pages/CitiesPage.vue'),
        meta: {
          titleKey: 'cities.title',
          breadcrumb: 'cities.title',
          anyPermission: [P.CitiesRead],
        },
      },
      {
        path: 'offers',
        name: 'offers',
        component: () => import('@/pages/OffersPage.vue'),
        meta: {
          titleKey: 'offers.title',
          breadcrumb: 'offers.title',
          anyPermission: [P.OffersRead],
        },
      },
      {
        path: 'branch-rules',
        name: 'branch-rules',
        component: () => import('@/pages/BranchRulesPage.vue'),
        meta: {
          titleKey: 'branchRules.title',
          breadcrumb: 'branchRules.title',
          anyPermission: [P.BranchDiscountsRead],
        },
      },
      {
        path: 'vouchers',
        name: 'vouchers',
        component: () => import('@/pages/VouchersPage.vue'),
        meta: {
          titleKey: 'vouchers.title',
          breadcrumb: 'vouchers.title',
          anyPermission: [P.VouchersValidate, P.VouchersConsume, P.UserVouchersRead],
        },
      },
      {
        path: 'all-vouchers',
        name: 'all-vouchers',
        component: () => import('@/pages/AllVouchersPage.vue'),
        meta: {
          titleKey: 'vouchers.allVouchers',
          breadcrumb: 'vouchers.allVouchers',
          anyPermission: [P.VouchersRead],
        },
      },
      {
        path: 'statistics',
        name: 'statistics',
        component: () => import('@/pages/StatisticsPage.vue'),
        meta: {
          titleKey: 'statistics.title',
          breadcrumb: 'statistics.title',
          anyPermission: [P.AnalyticsRead],
        },
      },
      {
        path: 'subscriptions',
        name: 'subscriptions',
        component: () => import('@/pages/SubscriptionProcessingPage.vue'),
        meta: {
          titleKey: 'subscriptions.title',
          breadcrumb: 'subscriptions.title',
          anyPermission: [P.SubscriptionsProcess],
        },
      },

      // ── Configuration ─────────────────────────────────────────────────────
      {
        path: 'settings/points',
        name: 'point-settings',
        component: () => import('@/pages/PointSettingsPage.vue'),
        meta: {
          titleKey: 'settings.title',
          breadcrumb: 'settings.title',
          anyPermission: [P.LoyaltyConfigurationRead],
        },
      },

      // ── Administration ────────────────────────────────────────────────────
      {
        path: 'admins',
        name: 'admins',
        component: () => import('@/pages/AdminsPage.vue'),
        meta: {
          titleKey: 'admins.title',
          breadcrumb: 'admins.title',
          anyPermission: [P.AdminsRead],
        },
      },
      {
        path: 'roles',
        name: 'roles',
        component: () => import('@/pages/RolesPage.vue'),
        meta: {
          titleKey: 'roles.title',
          breadcrumb: 'roles.title',
          anyPermission: [P.RolesRead],
        },
      },
      {
        path: 'permissions',
        name: 'permissions',
        component: () => import('@/pages/PermissionsPage.vue'),
        meta: {
          titleKey: 'permissions.title',
          breadcrumb: 'permissions.title',
          anyPermission: [P.PermissionsRead],
        },
      },
      {
        path: 'clients',
        name: 'clients',
        component: () => import('@/pages/ClientsPage.vue'),
        meta: {
          titleKey: 'clients.title',
          breadcrumb: 'clients.title',
          anyPermission: [P.ClientsRead],
        },
      },

      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/pages/ProfilePage.vue'),
        meta: { titleKey: 'nav.profile', breadcrumb: 'nav.profile' },
      },

      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/pages/ForbiddenPage.vue'),
        meta: { titleKey: 'states.forbiddenTitle' },
      },
    ],
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { public: true, titleKey: 'states.notFoundTitle' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * One guard handles the session and authorisation.
 *
 * A stored token is replayed against `/me` on the first navigation, so a reload
 * lands back on the requested page rather than bouncing through the login screen.
 * Authorisation is advisory here: hiding a page the backend would refuse is a
 * courtesy, and the API remains the authority.
 */
let restoreAttempted = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!restoreAttempted && !auth.isAuthenticated) {
    restoreAttempted = true
    await auth.restore()
  }

  if (to.meta.public) {
    // A signed-in user has no reason to see the login screen.
    if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  const required = to.meta.anyPermission
  if (required?.length && !auth.hasAnyPermission(...required)) {
    return { name: 'forbidden' }
  }

  return true
})
