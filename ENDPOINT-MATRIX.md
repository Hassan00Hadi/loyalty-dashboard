# API endpoint matrix

Derived from the backend source (`Controllers/V1/**`, `Handler/Authorization/Permissions.cs`,
`Entity/DTO/**`), not from a guess at the shape. Every row below was called against a
running instance and returned the status shown.

`Shared` permissions accept either an admin JWT or an `X-Client-Key`; the dashboard
always authenticates as an admin.

## Authentication

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/admin/auth/login` | POST | anonymous | — | `AdminLoginRequest` | `AdminLoginResponse` | Login | Sign in |
| `/api/v1/admin/auth/me` | GET | admin | any authenticated | — | `AdminIdentityDto` | — | Restore session on reload |
| `/api/v1/admin/auth/change-password` | POST | admin | any authenticated | `ChangeOwnPasswordRequest` | `bool` | My Profile | Change own password |

## Member loyalty data

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/loyalty/users/wallets` | GET | shared | `UserPoints.Read` | `UserLoyaltyQuery` (paged, `membershipTierId`) | `PagedResult<UserLoyaltyDto>` | Wallets | List, tier filter, server paging |
| `/api/v1/loyalty/users/{userId}/wallet` | GET | shared | `UserPoints.Read` | — | `UserLoyaltyDto` | Wallet detail | Summary card |
| `/api/v1/loyalty/users/{userId}/point-transactions` | GET | shared | `UserPoints.Read` | `PointTransactionQuery` (paged, `type`) | `PagedResult<PointTransactionDto>` | Wallet detail, Point Transactions | History, type filter |
| `/api/v1/loyalty/users/{userId}/rank` | GET | shared | `UserRank.Read` | — | `UserRankDto` | — | **Not surfaced** — the wallet response already carries `rank`; a second call would duplicate it |
| `/api/v1/loyalty/users/{userId}/vouchers` | GET | shared | `UserVouchers.Read` | `VoucherQuery` (paged, `status`) | `PagedResult<VoucherDto>` | Wallet detail, Vouchers | List, status filter, QR detail |

## Subscription processing

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/loyalty/subscriptions/process` | POST | shared | `Subscriptions.Process` | `ProcessSubscriptionRequest` — required `userId`, `price`; optional `username`, `fullName`, `phoneNumber`, `subscriptionId`, `packageId`, `packageName`, `isMobileApp` | `ProcessSubscriptionResponse` | Subscription Processing | Submit award |

Notes: points are computed server-side as `floor(price / pointThreshold) × pointsPerThreshold`.
The dashboard performs no point arithmetic and reads no package rule. The endpoint is
**not idempotent** and the UI does no duplicate detection on `subscriptionId`; it only
disables submit while a request is in flight.

## Vouchers (merchant-facing)

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/loyalty/vouchers/validate` | POST | shared | `Vouchers.Validate` | `ValidateVoucherRequest` | `ValidateVoucherResponse` | Vouchers | Validate a presented code |
| `/api/v1/loyalty/vouchers/consume` | POST | shared | `Vouchers.Consume` | `ConsumeVoucherRequest` | `ConsumeVoucherResponse` | Vouchers | Consume, behind a confirmation |

`merchantId` is required for an administrator, who carries no merchant scope of their own.

## Catalogue

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/loyalty/categories` | GET | shared | `Categories.Read` | — (unpaged) | `AdminCategoryDto[]` | Categories | List, in-memory search |
| `/api/v1/loyalty/categories` | POST | shared | `Categories.Create` | `CreateCategoryRequest` | `AdminCategoryDto` | Categories | Create |
| `/api/v1/loyalty/categories/{id}` | PATCH | shared | `Categories.Update` | `UpdateCategoryRequest` | `AdminCategoryDto` | Categories | Edit, activate/deactivate |
| `/api/v1/loyalty/merchants` | GET | shared | `Merchants.Read` | `categoryId?` | `AdminMerchantDto[]` | Merchants | List, category filter |
| `/api/v1/loyalty/merchants` | POST | shared | `Merchants.Create` | `CreateMerchantRequest` | `AdminMerchantDto` | Merchants | Create |
| `/api/v1/loyalty/merchants/{id}` | PATCH | shared | `Merchants.Update` | `UpdateMerchantRequest` | `AdminMerchantDto` | Merchants | Edit, activate/deactivate |
| `/api/v1/loyalty/offers` | GET | shared | `Offers.Read` | `merchantId?` | `AdminOfferDto[]` | Offers | List, merchant filter |
| `/api/v1/loyalty/offers` | POST | shared | `Offers.Create` | `CreateOfferRequest` | `AdminOfferDto` | Offers | Create |
| `/api/v1/loyalty/offers/{id}` | PATCH | shared | `Offers.Update` | `UpdateOfferRequest` | `AdminOfferDto` | Offers | Edit, activate/deactivate |
| `/api/v1/loyalty/branches` | GET | shared | `Branches.Read` | `merchantId?` | `MerchantBranchResponseDTO[]` | Branches | List, merchant filter |
| `/api/v1/loyalty/branches/{id}` | GET | shared | `Branches.Read` | — | `MerchantBranchResponseDTO` | — | **Not surfaced** — the list already returns every field the detail does |
| `/api/v1/loyalty/branches` | POST | shared | `Branches.Create` | `MerchantBranchRequestDTO` | `MerchantBranchResponseDTO` | Branches | Create |
| `/api/v1/loyalty/branches/{id}` | PUT | shared | `Branches.Update` | `MerchantBranchRequestDTO` | `MerchantBranchResponseDTO` | — | **Not surfaced** — PATCH covers the same edit without resending unchanged fields |
| `/api/v1/loyalty/branches/{id}` | PATCH | shared | `Branches.Update` | `MerchantBranchUpdateDTO` | `MerchantBranchResponseDTO` | Branches | Edit, when no image changed |
| `/api/v1/loyalty/branches/with-images` | POST | shared | `Branches.Create` | multipart (`Background`, `Icon`) | `MerchantBranchResponseDTO` | Branches | Create, when an image was chosen |
| `/api/v1/loyalty/branches/{id}/with-images` | PATCH | shared | `Branches.Update` | multipart (`Background`, `Icon`, `ClearBackground`, `ClearIcon`) | `MerchantBranchResponseDTO` | Branches | Edit, when an image changed |
| `/api/v1/loyalty/branches/{id}` | DELETE | shared | `Branches.Delete` | — | `bool` | Branches | Delete, behind a confirmation |

Categories, merchants and offers have **no DELETE** on the API. Each page says so and
offers deactivation instead of an action that would fail.

## Configuration

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/loyalty/configuration` | GET | shared | `LoyaltyConfiguration.Read` | — | `LoyaltyConfigurationDto` | Point Settings, Dashboard, Subscription | Read the formula |
| `/api/v1/loyalty/configuration` | PUT | shared | `LoyaltyConfiguration.Update` | `UpdateLoyaltyConfigurationRequest` | `LoyaltyConfigurationDto` | Point Settings | Save the formula |
| `/api/v1/loyalty/tiers` | GET | shared | `MembershipTiers.Read` | — | `MembershipTierDto[]` | Tiers, and every tier picker | List |
| `/api/v1/loyalty/tiers` | POST | shared | `MembershipTiers.Create` | `CreateMembershipTierRequest` | `MembershipTierDto` | Tiers | Create |
| `/api/v1/loyalty/tiers/{id}` | PATCH | shared | `MembershipTiers.Update` | `UpdateMembershipTierRequest` | `MembershipTierDto` | Tiers | Edit, activate/deactivate |

## Administration

| Endpoint | Method | Auth | Permission | Request | Response | Page | UI action |
|---|---|---|---|---|---|---|---|
| `/api/v1/admin/admins` | GET | admin | `Admins.Read` | `PageRequest` | `PagedResult<AdminDto>` | Admin Users | List, server paging |
| `/api/v1/admin/admins/{id}` | GET | admin | `Admins.Read` | — | `AdminDto` | — | **Not surfaced** — the list row carries every field the edit form needs |
| `/api/v1/admin/admins` | POST | admin | `Admins.Create` | `CreateAdminRequest` | `AdminDto` | Admin Users | Create, with roles |
| `/api/v1/admin/admins/{id}` | PUT | admin | `Admins.Update` | `UpdateAdminRequest` | `AdminDto` | Admin Users | Edit, optional password reset |
| `/api/v1/admin/admins/{id}` | DELETE | admin | `Admins.Delete` | — | `bool` | Admin Users | Deactivate, behind a confirmation |
| `/api/v1/admin/admins/{id}/roles` | GET | admin | `Admins.Read` | — | `RoleSummaryDto[]` | — | **Not surfaced** — `AdminDto.roles` already carries this |
| `/api/v1/admin/admins/{id}/roles` | PUT | admin | `Admins.ManageRoles` | `AssignRolesRequest` | `RoleSummaryDto[]` | Admin Users | Replace role set |
| `/api/v1/admin/roles` | GET | admin | `Roles.Read` | — | `RoleDto[]` | Roles | List |
| `/api/v1/admin/roles/{id}` | GET | admin | `Roles.Read` | — | `RoleDto` | — | **Not surfaced** — the list returns full roles with permissions |
| `/api/v1/admin/roles` | POST | admin | `Roles.Create` | `CreateRoleRequest` | `RoleDto` | Roles | Create, with permissions |
| `/api/v1/admin/roles/{id}` | PUT | admin | `Roles.Update` | `UpdateRoleRequest` | `RoleDto` | Roles | Edit name/description |
| `/api/v1/admin/roles/{id}` | DELETE | admin | `Roles.Delete` | — | `bool` | Roles | Delete (hidden for system roles) |
| `/api/v1/admin/roles/{id}/permissions` | GET | admin | `Roles.Read` | — | `PermissionDto[]` | — | **Not surfaced** — `RoleDto.permissions` already carries this |
| `/api/v1/admin/roles/{id}/permissions` | PUT | admin | `Roles.ManagePermissions` | `AssignPermissionsRequest` | `PermissionDto[]` | Roles | Replace permission set |
| `/api/v1/admin/permissions` | GET | admin | `Permissions.Read` | — | `PermissionDto[]` | Permissions, all pickers | Read the catalogue |
| `/api/v1/admin/clients` | GET | admin | `Clients.Read` | — | `ClientDto[]` | API Clients | List |
| `/api/v1/admin/clients/{id}` | GET | admin | `Clients.Read` | — | `ClientDto` | — | **Not surfaced** — the list row is sufficient |
| `/api/v1/admin/clients` | POST | admin | `Clients.Create` | `CreateClientRequest` | `ClientCreatedDto` | API Clients | Create; one-time secret dialog |
| `/api/v1/admin/clients/{id}` | PUT | admin | `Clients.Update` | `UpdateClientRequest` | `ClientDto` | API Clients | Edit |
| `/api/v1/admin/clients/{id}` | DELETE | admin | `Clients.Delete` | — | `bool` | API Clients | Delete, behind a confirmation |
| `/api/v1/admin/clients/{id}/revoke` | POST | admin | `Clients.Revoke` | — | `ClientDto` | API Clients | Revoke key, behind a confirmation |
| `/api/v1/admin/clients/{id}/permissions` | GET | admin | `Clients.Read` | — | `PermissionDto[]` | — | **Not surfaced** — `ClientDto.permissions` already carries this |
| `/api/v1/admin/clients/{id}/permissions` | PUT | admin | `Clients.ManagePermissions` | `AssignPermissionsRequest` | `PermissionDto[]` | API Clients | Replace permission set |

## Deliberately not surfaced

| Endpoint | Method | Why |
|---|---|---|
| `/api/v1/categories`, `/api/v1/merchants` | GET | The public (member-facing) catalogue. The dashboard uses the richer admin equivalents under `/api/v1/loyalty/*`, which add status and counts. |
| `/api/v1/offers`, `/api/v1/offers/{id}` | GET | Member-facing offer browsing, scored against the calling *member's* points and rank (`canRedeem`, `hasEnoughPoints`). An administrator is not a member, so these flags would be meaningless here. |
| `/api/v1/offers/{offerId}/redeem` | POST | Redeems points from the **caller's own** wallet. An administrator has no member wallet, so this cannot be exercised from an admin dashboard without misrepresenting who is redeeming. |
| `/api/v1/me/loyalty`, `/api/v1/me/point-transactions`, `/api/v1/me/vouchers` | GET | The signed-in *member's* own data, read from a member token. Admin tokens are a different scheme; the equivalent admin reads are the `/loyalty/users/{userId}/*` endpoints, which the dashboard does use. |
| `/api/v1/loyalty/attachments/**` | all | A general-purpose file store (`Attachments.*`). The dashboard never uploads to it directly: merchant, branch and category images travel as multipart parts on the entity's own write, and the backend creates and owns the attachment. Only `GET /attachments/constraints` is called, to validate size and type before submitting. |

## Known API limits reflected in the UI

These are stated on the relevant screens so a gap reads as a documented constraint
rather than a missing feature.

- **No member identity.** `UserLoyaltyDto` carries only `userId`, points, rank and a
  timestamp. There is no username, full name or phone number, and no lifetime
  earned/spent split. Names live in the upstream subscription system.
- **No global voucher list.** Vouchers are readable only per member, so the Vouchers
  page asks for a user id and the merchant-facing validate/consume pair stands alone.
- **No transaction list across members.** Same shape: per-member only.
- **No aggregate statistics endpoint.** Dashboard counts come from list endpoints, and
  the two wallet figures describe the fetched page — the cards say so.
- **No time-series data.** No user-growth or activity-over-time chart is shown, because
  nothing in the API can answer it without fabrication.
- **Unpaged list endpoints.** Categories, merchants, offers, branches, tiers,
  rules, roles and clients all return full arrays; those tables filter in memory. Wallets,
  transactions, vouchers and admins are genuinely server-paged.
