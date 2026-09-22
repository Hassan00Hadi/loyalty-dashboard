import {
  Building2,
  ChartColumn,
  CreditCard,
  FolderTree,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  MapPin,
  Medal,
  Package,
  Receipt,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tags,
  Ticket,
  TicketCheck,
  UserCog,
  Wallet,
} from 'lucide-vue-next'
import { P } from '@/utils/permissions'

export interface NavItem {
  /** Named route to navigate to. */
  name: string
  labelKey: string
  icon: LucideIcon
  /** Shown when the caller holds any one of these. Omitted means always. */
  anyPermission?: string[]
}

export interface NavSection {
  labelKey?: string
  items: NavItem[]
}

/**
 * The sidebar's contents.
 *
 * Every entry corresponds to a page backed by real endpoints, and each carries
 * the permissions that make it reachable — the same ones the router enforces, so
 * a visible link never leads to a 403 page.
 */
export const navigation: NavSection[] = [
  {
    items: [{ name: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'nav.loyalty',
    items: [
      {
        name: 'wallets',
        labelKey: 'nav.wallets',
        icon: Wallet,
        anyPermission: [P.UserPointsRead],
      },
      {
        name: 'transactions',
        labelKey: 'nav.transactions',
        icon: Receipt,
        anyPermission: [P.UserPointsRead],
      },
      {
        name: 'tiers',
        labelKey: 'nav.tiers',
        icon: Medal,
        anyPermission: [P.MembershipTiersRead],
      },
      {
        name: 'categories',
        labelKey: 'nav.categories',
        icon: FolderTree,
        anyPermission: [P.CategoriesRead],
      },
      {
        name: 'merchants',
        labelKey: 'nav.merchants',
        icon: Store,
        anyPermission: [P.MerchantsRead],
      },
      {
        name: 'branches',
        labelKey: 'nav.branches',
        icon: MapPin,
        anyPermission: [P.BranchesRead],
      },
      {
        name: 'cities',
        labelKey: 'nav.cities',
        icon: Building2,
        anyPermission: [P.CitiesRead],
      },
      { name: 'offers', labelKey: 'nav.offers', icon: Tags, anyPermission: [P.OffersRead] },
      {
        name: 'branch-rules',
        labelKey: 'nav.branchRules',
        icon: SlidersHorizontal,
        anyPermission: [P.BranchDiscountsRead],
      },
      {
        name: 'vouchers',
        labelKey: 'nav.vouchers',
        icon: Ticket,
        anyPermission: [P.VouchersValidate, P.VouchersConsume, P.UserVouchersRead],
      },
      {
        name: 'all-vouchers',
        labelKey: 'nav.allVouchers',
        icon: TicketCheck,
        anyPermission: [P.VouchersRead],
      },
      {
        name: 'statistics',
        labelKey: 'nav.statistics',
        icon: ChartColumn,
        anyPermission: [P.AnalyticsRead],
      },
      {
        name: 'subscriptions',
        labelKey: 'nav.subscriptions',
        icon: CreditCard,
        anyPermission: [P.SubscriptionsProcess],
      },
    ],
  },
  {
    labelKey: 'nav.configuration',
    items: [
      {
        name: 'point-settings',
        labelKey: 'nav.pointSettings',
        icon: Gauge,
        anyPermission: [P.LoyaltyConfigurationRead],
      },
      {
        name: 'packages',
        labelKey: 'nav.packages',
        icon: Package,
        anyPermission: [P.PackagesRead],
      },
      {
        name: 'package-rules',
        labelKey: 'nav.packageRules',
        icon: Layers,
        anyPermission: [P.PackageRulesRead],
      },
    ],
  },
  {
    labelKey: 'nav.administration',
    items: [
      { name: 'admins', labelKey: 'nav.admins', icon: UserCog, anyPermission: [P.AdminsRead] },
      { name: 'roles', labelKey: 'nav.roles', icon: ShieldCheck, anyPermission: [P.RolesRead] },
      {
        name: 'permissions',
        labelKey: 'nav.permissions',
        icon: Settings2,
        anyPermission: [P.PermissionsRead],
      },
      {
        name: 'clients',
        labelKey: 'nav.integration',
        icon: KeyRound,
        anyPermission: [P.ClientsRead],
      },
    ],
  },
]
