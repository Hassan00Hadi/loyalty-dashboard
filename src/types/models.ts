/**
 * Domain models, transcribed from the backend DTOs.
 *
 * Field names and nullability match the server exactly — including places where
 * the API is narrower than a dashboard might wish (see `UserLoyalty`, which
 * carries no name or phone number). Where a field does not exist on the server it
 * does not exist here, so a screen cannot silently invent one.
 */
import type { PageRequest } from './api'

// ── Enums ─────────────────────────────────────────────────────────────────────
// Serialised as strings by the API (`JsonStringEnumConverter`), so these are
// string unions rather than numeric enums.

export const POINT_TRANSACTION_TYPES = ['Earned', 'Spent', 'Adjustment'] as const
export type PointTransactionType = (typeof POINT_TRANSACTION_TYPES)[number]

export const VOUCHER_STATUSES = ['Active', 'Used', 'Expired', 'Cancelled'] as const
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number]

export const ATTACHMENT_KINDS = ['Image', 'Document'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

/** How a discount's value is read: a proportion of the bill, or an amount in IQD. */
export const DISCOUNT_TYPES = ['Percentage', 'FixedAmount'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export const ATTACHMENT_OWNER_TYPES = [
  'None',
  'Merchant',
  'MerchantBranch',
  'Offer',
  'Category',
  'User',
] as const
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number]

// ── Shared references ─────────────────────────────────────────────────────────

/**
 * The tier label the UI shows, computed by the backend from `level`:
 * P1 → Bronze, P2 → Silver, P3 and above → Gold.
 *
 * It is a string rather than a union because the mapping belongs to the server —
 * a new rank there must not require a frontend release to be displayable.
 */
export type DisplayTier = string

export interface MembershipTierSummary {
  id: string
  name: string
  level: number
  /** Backend-derived display tier. Never recomputed from `level` in the frontend. */
  displayTier: DisplayTier
  iconUrl: string | null
}

export interface MembershipTierRef {
  id: string
  name: string
  level: number
  displayTier: DisplayTier
}

export interface CityRef {
  id: string
  name: string
}

// ── Authentication and identity ───────────────────────────────────────────────

export interface AdminLoginRequest {
  email: string
  password: string
}

export interface AdminIdentity {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  /** Advisory only — every endpoint re-checks server-side. */
  permissions: string[]
}

export interface AdminLoginResponse {
  accessToken: string
  expiresAt: string
  admin: AdminIdentity
}

export interface ChangeOwnPasswordRequest {
  currentPassword: string
  newPassword: string
}

// ── Administrators, roles, permissions, clients ───────────────────────────────

export interface RoleSummary {
  id: string
  name: string
}

export interface Admin {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  lastLoginAt: string | null
  isLockedOut: boolean
  roles: RoleSummary[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateAdminRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  isActive: boolean
  roleIds: string[]
}

export interface UpdateAdminRequest {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean | null
  password?: string | null
}

export interface Permission {
  id: string
  name: string
  group: string
  description: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  isSystemRole: boolean
  adminCount: number
  permissions: Permission[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateRoleRequest {
  name: string
  description?: string | null
  permissionIds: string[]
}

export interface UpdateRoleRequest {
  name?: string | null
  description?: string | null
}

export interface ApiClient {
  id: string
  name: string
  description: string | null
  /** Contact address for this client's owner. */
  contactEmail: string | null
  /** Non-secret lookup segment, safe to display so a key can be recognised. */
  keyPrefix: string
  isActive: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  merchantId: string | null
  permissions: Permission[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateClientRequest {
  name: string
  description?: string | null
  contactEmail?: string | null
  permissionIds: string[]
  expiresAt?: string | null
  /** Binds the client to one merchant; required for merchant-scoped voucher calls. */
  merchantId?: string | null
}

export interface UpdateClientRequest {
  name?: string | null
  description?: string | null
  contactEmail?: string | null
  isActive?: boolean | null
  expiresAt?: string | null
  merchantId?: string | null
}

/**
 * The one-time result of creating a client. `secretKey` exists only in this
 * response — it is not stored and no other endpoint returns it.
 */
export interface ClientCreated {
  id: string
  name: string
  keyPrefix: string
  secretKey: string
  contactEmail: string | null
  expiresAt: string | null
  permissions: Permission[]
}

// ── Member loyalty data ───────────────────────────────────────────────────────

export interface PointsSummary {
  available: number
}

/**
 * A member's wallet as the API exposes it.
 *
 * Name, phone number and city are copied from the member's mobile token, so they
 * are null until the member has used the app. Lifetime earned/spent live in the
 * upstream subscription system.
 */
export interface UserLoyalty {
  userId: string
  fullName: string | null
  /** Shown on the Points Wallet alongside the member's points and tier. */
  phoneNumber: string | null
  /** The token's city matched to a configured city; null when absent or unmatched. */
  cityId: string | null
  cityName: string | null
  points: PointsSummary
  rank: MembershipTierSummary | null
  updatedAt: string
}

export interface UserRank {
  userId: string
  rank: MembershipTierSummary | null
  updatedAt: string
}

export interface PointTransaction {
  id: string
  type: PointTransactionType
  amount: number
  externalSubscriptionId: string | null
  externalPackageId: string | null
  packageName: string | null
  packagePrice: number | null
  isMobileApp: boolean | null
  referenceId: string | null
  description: string | null
  /** Present on spending-based awards; null on legacy package awards. */
  amountSpent: number | null
  /** The configured spending amount in IQD at the time of the award. */
  amountIqd: number | null
  /** Points earned per `amountIqd` at the time of the award. */
  pointsPerAmount: number | null
  createdAt: string
}

export interface UserLoyaltyQuery extends PageRequest {
  membershipTierId?: string | null
  /** Case-insensitive partial match on the member's phone number. */
  phoneNumber?: string | null
}

export interface PointTransactionQuery extends PageRequest {
  type?: PointTransactionType | null
}

// ── Vouchers ──────────────────────────────────────────────────────────────────

export interface Voucher {
  id: string
  voucherCode: string
  /** The scannable token, or null when the offer issues vouchers without a QR. */
  qrCodeData: string | null
  offerId: string
  offerTitle: string
  merchantName: string | null
  discountType: DiscountType
  /** A percentage when `discountType` is Percentage, otherwise an amount in IQD. */
  discountValue: number
  /** Legacy: equals `discountValue` for percentage offers, zero for fixed-amount ones. */
  discountPercentage: number
  status: VoucherStatus
  createdAt: string
  expiresAt: string
  usedAt: string | null
}

export interface VoucherQuery extends PageRequest {
  status?: VoucherStatus | null
}

export interface MerchantOfferRef {
  id: string
  title: string
}

export interface ValidateVoucherRequest {
  voucherCode: string
  merchantId?: string | null
  /** The branch presenting the voucher, so a branch-bound one is reported correctly. */
  branchId?: string | null
}

export interface ValidateVoucherResponse {
  valid: boolean
  voucherCode: string
  status: VoucherStatus
  discountType: DiscountType
  /** A percentage when `discountType` is Percentage, otherwise an amount in IQD. */
  discountValue: number
  discountPercentage: number
  offer: MerchantOfferRef
  expiresAt: string
}

export interface ConsumeVoucherRequest {
  voucherCode: string
  orderId?: string | null
  merchantId?: string | null
  /**
   * The branch taking the voucher. Required for a voucher issued against a branch: it
   * carries that branch's discount and may only be honoured there.
   */
  branchId?: string | null
}

export interface ConsumeVoucherResponse {
  voucherCode: string
  status: VoucherStatus
  discountType: DiscountType
  discountValue: number
  discountPercentage: number
  usedAt: string
  orderId: string | null
  offer: MerchantOfferRef
}

// ── Catalogue: categories, merchants, branches, offers ────────────────────────

export interface AdminCategory {
  id: string
  name: string
  /** Resolved from `iconAttachmentId` when uploaded, else the stored external URL. */
  iconUrl: string | null
  iconAttachmentId: string | null
  isActive: boolean
  merchantCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateCategoryRequest {
  name: string
  /** A previously uploaded image attachment. Preferred over `iconUrl`. */
  iconAttachmentId?: string | null
  iconUrl?: string | null
  isActive: boolean
}

export interface UpdateCategoryRequest {
  name?: string | null
  iconAttachmentId?: string | null
  /** Clears the icon, whether it was an upload or an external URL. */
  clearIcon?: boolean
  iconUrl?: string | null
  isActive?: boolean | null
}

/** One of a merchant's cities, with how many of its branches operate there. */
export interface MerchantCity {
  id: string
  name: string
  branchCount: number
}

export interface AdminMerchant {
  id: string
  categoryId: string
  categoryName: string | null
  name: string
  /** Resolved from `logoAttachmentId` when uploaded, else the stored external URL. */
  logoUrl: string | null
  logoAttachmentId: string | null
  /**
   * The wide image behind the merchant's header, resolved the same way as the
   * logo. Distinct from the logo, which stays the merchant's identity mark.
   */
  backgroundUrl: string | null
  backgroundAttachmentId: string | null
  /** The compact square mark, resolved the same way as the logo. */
  iconUrl: string | null
  iconAttachmentId: string | null
  description: string | null
  isActive: boolean
  offerCount: number
  branchCount: number
  /** Vouchers ever issued against this merchant's offers. */
  activatedVouchers: number
  /** Of those, the vouchers already consumed. */
  consumedVouchers: number
  /** General vouchers (offers without a merchant) consumed at this merchant. */
  generalVouchersConsumed: number
  /** The cities this merchant operates in, as the backend reports them. */
  cities: MerchantCity[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateMerchantRequest {
  categoryId: string
  name: string
  /** A previously uploaded image attachment. Preferred over `logoUrl`. */
  logoAttachmentId?: string | null
  logoUrl?: string | null
  backgroundAttachmentId?: string | null
  backgroundUrl?: string | null
  iconAttachmentId?: string | null
  iconUrl?: string | null
  description?: string | null
  /** The cities the merchant operates in; branches may only open in these. */
  cityIds?: string[] | null
  isActive: boolean
}

export interface UpdateMerchantRequest {
  categoryId?: string | null
  name?: string | null
  logoAttachmentId?: string | null
  /** Clears the logo, whether it was an upload or an external URL. */
  clearLogo?: boolean
  logoUrl?: string | null
  backgroundAttachmentId?: string | null
  /** Clears the background, whether it was an upload or an external URL. */
  clearBackground?: boolean
  backgroundUrl?: string | null
  iconAttachmentId?: string | null
  /** Clears the icon, whether it was an upload or an external URL. */
  clearIcon?: boolean
  iconUrl?: string | null
  description?: string | null
  /**
   * Replaces the city list when supplied. The backend refuses to remove a city
   * that still hosts one of the merchant's branches.
   */
  cityIds?: string[] | null
  isActive?: boolean | null
}

export interface MerchantBranch {
  id: string
  merchantId: string
  /** The city this branch operates in, shared with the merchant's other branches there. */
  cityId: string | null
  cityName: string | null
  name: string
  address: string | null
  latitude: string
  longitude: string
  phoneNumber: string | null
  /** The wide header image, resolved from its attachment or the stored URL. */
  backgroundUrl: string | null
  backgroundAttachmentId: string | null
  /** The compact square mark, resolved the same way as the background. */
  iconUrl: string | null
  iconAttachmentId: string | null
  isActive: boolean
  /**
   * Vouchers issued for this branch. Only branch-bound offers issue a voucher
   * for a specific branch, so vouchers valid at any branch are not counted here.
   */
  activatedVouchers: number
  /** Vouchers consumed at this branch, whether branch-bound or not. */
  consumedVouchers: number
  createdAt: string
  updatedAt: string | null
}

export interface MerchantBranchRequest {
  merchantId: string
  /** Must be a city of the same merchant; the backend rejects another merchant's. */
  cityId?: string | null
  name: string
  address?: string | null
  latitude: string
  longitude: string
  phoneNumber?: string | null
  backgroundAttachmentId?: string | null
  backgroundUrl?: string | null
  iconAttachmentId?: string | null
  iconUrl?: string | null
  isActive: boolean
}

export interface MerchantBranchPatch {
  merchantId?: string | null
  cityId?: string | null
  /**
   * Removes the branch's city. Needed because `cityId: null` in a sparse update means
   * "leave it alone", which is a different intention from "this branch has no city".
   */
  clearCity?: boolean
  name?: string | null
  address?: string | null
  latitude?: string | null
  longitude?: string | null
  phoneNumber?: string | null
  backgroundAttachmentId?: string | null
  /** Removes the background. As with `clearCity`, a null URL only means "unchanged". */
  clearBackground?: boolean
  backgroundUrl?: string | null
  iconAttachmentId?: string | null
  /** Removes the icon. As with `clearCity`, a null URL only means "unchanged". */
  clearIcon?: boolean
  iconUrl?: string | null
  isActive?: boolean | null
}

// ── Cities ────────────────────────────────────────────────────────────────────

/**
 * A city a merchant operates in.
 *
 * One row per city per merchant, shared by every branch operating there: Branch A and
 * Branch B in Baghdad both reference this same row. That shared identity is what makes
 * offer eligibility a plain id comparison.
 */
export interface City {
  id: string
  name: string
  description: string | null
  isActive: boolean
  /** How many offers are restricted to this city. */
  offerCount: number
  /** How many branches operate here, across every merchant. More than one is normal. */
  branchCount: number
  /** How many merchants have at least one branch here. */
  merchantCount: number
  createdAt: string
  updatedAt: string | null
}

/** A city is a place, so creating one needs nothing but its name. */
export interface CreateCityRequest {
  name: string
  description?: string | null
  isActive: boolean
}

/**
 * A sparse update. The merchant is deliberately absent: branches, offers and members all
 * reference this row, so moving it would silently redirect every one of those.
 */
export interface UpdateCityRequest {
  name?: string | null
  description?: string | null
  isActive?: boolean | null
}

export interface CityQuery extends PageRequest {
  search?: string | null
  /** Narrows to the cities a merchant has at least one branch in — where it operates. */
  merchantId?: string | null
  /** Narrows to the city a given branch operates in — at most one. */
  branchId?: string | null
  isActive?: boolean | null
}

// ── Branch offer rules ────────────────────────────────────────────────────────

/**
 * One branch's terms for an offer: its cost, its discount, and the validity of the
 * voucher it issues.
 *
 * A branch with no rule falls back to the offer's own values.
 */
export interface BranchOfferRule {
  id: string
  offerId: string
  offerTitle: string | null
  merchantId: string | null
  merchantName: string | null
  branchId: string
  branchName: string | null
  requiredPoints: number
  discountType: DiscountType
  discountValue: number
  /** Days a voucher issued here stays valid, counted from activation. */
  voucherValidityDays: number
  isActive: boolean
  startsAtUtc: string | null
  endsAtUtc: string | null
  /** Computed server-side: active and inside its window right now. */
  isApplicableNow: boolean
  /**
   * Distinct members who have used a voucher issued under this exact rule —
   * this offer at this branch.
   *
   * Read-only and counted by the backend. It is a member count, not a voucher
   * count, and it is scoped to the branch: it is a different statistic from
   * `AdminOffer.completedByUserCount`, which counts the offer across every
   * branch. The two are never summed or reconciled against each other.
   */
  completedByUserCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateBranchOfferRuleRequest {
  offerId: string
  branchId: string
  requiredPoints: number
  discountType: DiscountType
  discountValue: number
  voucherValidityDays: number
  startsAtUtc?: string | null
  endsAtUtc?: string | null
  isActive: boolean
}

/** Sparse. The offer and branch are fixed — moving a rule would be a different rule. */
export interface UpdateBranchOfferRuleRequest {
  requiredPoints?: number | null
  discountType?: DiscountType | null
  discountValue?: number | null
  voucherValidityDays?: number | null
  startsAtUtc?: string | null
  endsAtUtc?: string | null
  isActive?: boolean | null
  /** Distinguishes "clear the window" from "leave it alone", which both send null. */
  clearWindow?: boolean
}

export interface BranchOfferRuleQuery extends PageRequest {
  offerId?: string | null
  branchId?: string | null
  merchantId?: string | null
  isActive?: boolean | null
}

// ── Admin vouchers and statistics ─────────────────────────────────────────────

/** An issued voucher with the snapshot it was issued under. */
export interface AdminVoucher {
  id: string
  voucherCode: string
  /** The scannable token, or null when the offer issues vouchers without a QR. */
  qrCodeData: string | null
  externalUserId: string
  offerId: string
  offerTitle: string | null
  merchantId: string | null
  merchantName: string | null
  branchId: string | null
  branchName: string | null
  cityId: string | null
  cityName: string | null
  pointsSpent: number | null
  discountType: DiscountType
  discountValue: number
  discountPercentage: number
  status: VoucherStatus
  activatedAt: string
  expiresAt: string
  usedAt: string | null
}

export interface AdminVoucherQuery extends PageRequest {
  search?: string | null
  offerId?: string | null
  merchantId?: string | null
  branchId?: string | null
  cityId?: string | null
  userId?: string | null
  status?: VoucherStatus | null
  dateFrom?: string | null
  dateTo?: string | null
}

/** Totals aggregated in the database over the whole filtered set. */
export interface VoucherStatistics {
  activatedOffers: number
  activeVouchers: number
  usedVouchers: number
  expiredVouchers: number
  cancelledVouchers: number
  totalPointsSpent: number
  totalRedemptions: number
}

export interface BranchPerformance {
  branchId: string
  branchName: string
  merchantId: string
  merchantName: string | null
  cityId: string | null
  cityName: string | null
  activatedOffers: number
  activeVouchers: number
  usedVouchers: number
  expiredVouchers: number
  cancelledVouchers: number
  pointsSpent: number
}

export interface StatisticsQuery {
  merchantId?: string | null
  branchId?: string | null
  offerId?: string | null
  cityId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

/** A tier an offer is available to. */
export interface OfferTierRef {
  id: string
  name: string
  level: number
}

/** A branch an offer is restricted to. */
export interface OfferBranchRef {
  id: string
  name: string
  cityId: string | null
  cityName: string | null
}

export interface AdminOffer {
  id: string
  merchantId: string | null
  merchantName: string | null
  categoryId: string | null
  categoryName: string | null
  requiredMembershipTierId: string | null
  requiredMembershipTierName: string | null
  requiredMembershipTierLevel: number | null
  /** The city this offer belongs to; it records where the offer is worth redeeming. */
  cityId: string | null
  cityName: string | null
  /** Whether vouchers issued from this offer carry a QR code. */
  showQrCode: boolean
  title: string
  /** Customer-facing copy shown on the offer details view, not an admin note. */
  description: string | null
  requiredPoints: number
  discountType: DiscountType
  /** A percentage when `discountType` is Percentage, otherwise an amount in IQD. */
  discountValue: number
  /** Legacy: equals `discountValue` for percentage offers, zero for fixed-amount ones. */
  discountPercentage: number
  validDays: number
  minimumSpending: number | null
  /** When the offer stops being redeemable. Null means it never expires. */
  expiresAt: string | null
  isActive: boolean
  /** True when the offer is valid at every branch of its merchant. */
  appliesToAllBranches: boolean
  /** Tiers allowed to redeem the offer. Empty means every tier. */
  applicableTiers: OfferTierRef[]
  /** Branches the offer is restricted to. Empty when `appliesToAllBranches`. */
  applicableBranches: OfferBranchRef[]
  /**
   * Distinct members who have used a voucher for this offer.
   *
   * Read-only, counted by the backend: a member who redeems the same offer more
   * than once still counts once. Not settable through create or update.
   */
  completedByUserCount: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateOfferRequest {
  merchantId?: string | null
  requiredMembershipTierId?: string | null
  /** The city the offer belongs to. Omit or send null to leave it untied. */
  cityId?: string | null
  /**
   * Whether vouchers from this offer carry a QR code. Defaults to true.
   *
   * False generates no QR token at all — the voucher is presented by its code and cannot
   * be found by scanning. For an offer redeemed somewhere with no scanner.
   */
  showQrCode?: boolean
  title: string
  /** Customer-facing copy shown on the offer details view. */
  description?: string | null
  requiredPoints: number
  /** Percentage or FixedAmount; `discountValue` is validated against it. */
  discountType: DiscountType
  /**
   * A percentage in (0, 100] for a Percentage offer, otherwise an amount in IQD
   * greater than zero.
   */
  discountValue: number
  validDays: number
  minimumSpending?: number | null
  /** When the offer stops being redeemable. Omit for one that never expires. */
  expiresAt?: string | null
  /** Tiers allowed to redeem the offer. Omit or leave empty to allow every tier. */
  applicableTierIds?: string[] | null
  /** Ignored when `appliesToAllBranches`; every branch must belong to the merchant. */
  applicableBranchIds?: string[] | null
  appliesToAllBranches: boolean
  isActive: boolean
}

export interface UpdateOfferRequest {
  merchantId?: string | null
  requiredMembershipTierId?: string | null
  cityId?: string | null
  /** Clears the offer's city. Needed because a null cityId is ambiguous in a sparse update. */
  clearCity?: boolean
  /** Governs future vouchers only; ones already issued keep what they were given. */
  showQrCode?: boolean | null
  title?: string | null
  description?: string | null
  requiredPoints?: number | null
  discountType?: DiscountType | null
  discountValue?: number | null
  validDays?: number | null
  /**
   * Only changes the stored value when supplied. Omitting it leaves the merchant's
   * minimum spending exactly as it was, which is what editing any other field must do.
   */
  minimumSpending?: number | null
  /** Removes the minimum spending requirement. Distinct from omitting the field. */
  clearMinimumSpending?: boolean
  expiresAt?: string | null
  /** Removes the expiry so the offer no longer expires. */
  clearExpiry?: boolean
  /** Replaces the tier restriction when supplied. An empty list allows every tier. */
  applicableTierIds?: string[] | null
  /** Replaces the branch restriction when supplied. */
  applicableBranchIds?: string[] | null
  appliesToAllBranches?: boolean | null
  isActive?: boolean | null
}

// ── Admin offer search ────────────────────────────────────────────────────────

/** Fields the offer list may be ordered by, as the backend names them. */
export const OFFER_SORT_FIELDS = [
  'CreatedDate',
  'ExpiryDate',
  'DiscountValue',
  'RequiredPoints',
  'Title',
] as const
export type OfferSortField = (typeof OFFER_SORT_FIELDS)[number]

export const SORT_DIRECTIONS = ['Ascending', 'Descending'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

/**
 * Server-side filtering, sorting and paging for the admin offer list.
 *
 * Every field here is applied in the database. The dashboard never fetches the
 * whole offer list to filter it in JavaScript.
 */
export interface AdminOfferQuery extends PageRequest {
  merchantId?: string | null
  cityId?: string | null
  /** Matches the offer's required tier. */
  membershipTierId?: string | null
  /** Matches the category of the offer's merchant. */
  categoryId?: string | null
  /** Matches offers at this branch, explicitly or via "all branches". */
  branchId?: string | null
  isActive?: boolean | null
  discountType?: DiscountType | null
  /** Case-insensitive match on the offer title or description. */
  search?: string | null
  sortBy?: OfferSortField
  sortDirection?: SortDirection
}

// ── Configuration: tiers, point settings ──────────────────────────────────────

export interface MembershipTier {
  id: string
  name: string
  /** Rank order. Higher wins; there is no points threshold on a tier. */
  level: number
  description: string | null
  iconUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateMembershipTierRequest {
  name: string
  level: number
  description?: string | null
  iconUrl?: string | null
  isActive: boolean
}

export interface UpdateMembershipTierRequest {
  name?: string | null
  level?: number | null
  description?: string | null
  iconUrl?: string | null
  isActive?: boolean | null
}

/**
 * The global spend-to-points formula: `floor(price / amountIqd) × points`.
 *
 * Read as "every `amountIqd` spent earns `points` points" — for example
 * 50,000 IQD = 10 points. The arithmetic itself stays on the server; the
 * dashboard only previews it.
 */
export interface LoyaltyConfiguration {
  /** The spending amount in IQD required to earn `points` points. */
  amountIqd: number
  /** Points earned for every `amountIqd` spent. */
  points: number
}

export interface UpdateLoyaltyConfigurationRequest {
  amountIqd: number
  points: number
}

// ── Subscription processing ───────────────────────────────────────────────────

/**
 * The subscription award request.
 *
 * Only `userId` and `price` are required. `price` alone determines the award;
 * the package fields are recorded for traceability and do not affect points.
 */
export interface ProcessSubscriptionRequest {
  userId: string
  price: number
  username?: string | null
  fullName?: string | null
  phoneNumber?: string | null
  subscriptionId?: string | null
  packageId?: string | null
  packageName?: string | null
  isMobileApp?: boolean | null
}

export interface ProcessSubscriptionResponse {
  userId: string
  subscriptionId: string | null
  pointsEarned: number
  totalPoints: number
  rank: MembershipTierRef | null
}

// ── Attachments ───────────────────────────────────────────────────────────────

export interface Attachment {
  id: string
  fileName: string
  contentType: string
  sizeInBytes: number
  kind: AttachmentKind
  checksum: string
  ownerType: AttachmentOwnerType
  ownerId: string | null
  /** Relative URL that serves the file content. */
  url: string
  createdAt: string
  updatedAt: string | null
}

export interface AttachmentQuery extends PageRequest {
  ownerType?: AttachmentOwnerType | null
  ownerId?: string | null
  kind?: AttachmentKind | null
}

export interface AttachmentLinkRequest {
  ownerType?: AttachmentOwnerType | null
  ownerId?: string | null
  fileName?: string | null
}
