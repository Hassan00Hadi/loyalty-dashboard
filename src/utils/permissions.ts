/**
 * The permission names the backend declares, mirrored as constants.
 *
 * Transcribed from `Handler/Authorization/Permissions.cs`. Using a constant
 * rather than a string literal at each call site means a rename shows up as a
 * type error here instead of silently hiding a button forever.
 *
 * These names are identifiers, never displayed raw — the UI localises their
 * labels through the `permissions.*` message keys.
 */
export const P = {
  // Administration of the security system
  AdminsRead: 'Admins.Read',
  AdminsCreate: 'Admins.Create',
  AdminsUpdate: 'Admins.Update',
  AdminsDelete: 'Admins.Delete',
  AdminsManageRoles: 'Admins.ManageRoles',

  RolesRead: 'Roles.Read',
  RolesCreate: 'Roles.Create',
  RolesUpdate: 'Roles.Update',
  RolesDelete: 'Roles.Delete',
  RolesManagePermissions: 'Roles.ManagePermissions',

  PermissionsRead: 'Permissions.Read',

  ClientsRead: 'Clients.Read',
  ClientsCreate: 'Clients.Create',
  ClientsUpdate: 'Clients.Update',
  ClientsDelete: 'Clients.Delete',
  ClientsRevoke: 'Clients.Revoke',
  ClientsManagePermissions: 'Clients.ManagePermissions',

  // Loyalty catalogue and configuration
  CategoriesRead: 'Categories.Read',
  CategoriesCreate: 'Categories.Create',
  CategoriesUpdate: 'Categories.Update',

  MerchantsRead: 'Merchants.Read',
  MerchantsCreate: 'Merchants.Create',
  MerchantsUpdate: 'Merchants.Update',

  BranchesRead: 'Branches.Read',
  BranchesCreate: 'Branches.Create',
  BranchesUpdate: 'Branches.Update',
  BranchesDelete: 'Branches.Delete',

  CitiesRead: 'Cities.Read',
  CitiesCreate: 'Cities.Create',
  CitiesUpdate: 'Cities.Update',
  CitiesDelete: 'Cities.Delete',

  // Per-branch offer terms. Separate from Offers.* because configuring what a branch
  // charges is a different responsibility from creating the offer.
  BranchDiscountsRead: 'BranchDiscounts.Read',
  BranchDiscountsCreate: 'BranchDiscounts.Create',
  BranchDiscountsUpdate: 'BranchDiscounts.Update',
  BranchDiscountsDelete: 'BranchDiscounts.Delete',

  OffersRead: 'Offers.Read',
  OffersCreate: 'Offers.Create',
  OffersUpdate: 'Offers.Update',

  MembershipTiersRead: 'MembershipTiers.Read',
  MembershipTiersCreate: 'MembershipTiers.Create',
  MembershipTiersUpdate: 'MembershipTiers.Update',

  LoyaltyConfigurationRead: 'LoyaltyConfiguration.Read',
  LoyaltyConfigurationUpdate: 'LoyaltyConfiguration.Update',

  // Attachments
  AttachmentsRead: 'Attachments.Read',
  AttachmentsCreate: 'Attachments.Create',
  AttachmentsUpdate: 'Attachments.Update',
  AttachmentsDelete: 'Attachments.Delete',

  // Member data
  UserPointsRead: 'UserPoints.Read',
  UserRankRead: 'UserRank.Read',
  UserVouchersRead: 'UserVouchers.Read',

  // Capabilities exercised by external systems
  SubscriptionsProcess: 'Subscriptions.Process',
  VouchersValidate: 'Vouchers.Validate',
  VouchersConsume: 'Vouchers.Consume',

  // Administrative voucher oversight, distinct from the till-side pair above.
  VouchersRead: 'Vouchers.Read',
  VouchersCancel: 'Vouchers.Cancel',

  AnalyticsRead: 'Analytics.Read',
} as const

export type PermissionName = (typeof P)[keyof typeof P]
