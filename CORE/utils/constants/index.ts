export const MESSAGES = {
  SUCCESS: {
    LIVESTREAM_CREATED: 'Livestream created successfully.',
    LIVESTREAM_JOINED: 'Livestream joined successfully.',
    LIVESTREAM_FETCHED: 'Livestream fetched successfully.',
    PRODUCT_CREATED: 'Product created successfully.',
    AUCTION_CREATED: 'Auction created successfully.',
    AUCTION_CLOSED: 'Auction closed successfully.',
    BID_PLACED: 'Bid placed successfully.',
  },
  ERRORS: {
    UNAUTHORIZED: 'Unauthorized.',
    FORBIDDEN: 'Forbidden.',
    VALIDATION_FAILED: 'Validation failed.',
    INTERNAL: 'Internal server error.',
    PRODUCT_NOT_FOUND: 'Product not found.',
    ORDER_NOT_FOUND: 'Order not found.',
    ORDER_INVALID_STATE: 'Order cannot be paid in its current state.',
    AUCTION_NOT_FOUND: 'Auction not found.',
    AUCTION_NOT_OPEN: 'Auction is not open.',
    BID_TOO_LOW: 'Bid amount is too low.',
    LIVESTREAM_CONFIG_INVALID: 'Livestream provider is not configured.',
    LIVESTREAM_CREATE_FAILED: 'Failed to create livestream.',
    LIVESTREAM_FETCH_FAILED: 'Failed to fetch livestream.',
    LIVESTREAM_NOT_FOUND: 'Livestream not found.',
    LIVESTREAM_ENDED: 'Livestream has ended.',
    IDENTITY_REQUIRED_FOR_LIVE: 'Identity verification is required before going live.',
  },
} as const;

export const USER_TYPES = {
  VENDOR: 'vendor',
  BUYER: 'buyer',
  EDITOR: 'editor',
} as const;

export const ROLE_NAMES = {
  VENDOR: 'vendor',
  USER: 'member',
  ADMIN: 'admin',
  ADMIN_L1: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const SYSTEM_MESSAGES = {
  SUCCESS: {
    // Roles
    ROLE_CREATED: "Role created successfully.",
    ROLES_FETCHED: "Roles fetched successfully.",
    // Auth / OAuth
    OAUTH_INITIATED: "OAuth initiation successful.",
    OAUTH_CALLBACK_OK: "OAuth callback processed successfully.",
    // Auth — Registration & Password
    REGISTER_SUCCESS:
      "Account created successfully. Please check your inbox to verify your email.",
    EMAIL_VERIFIED: "Email verified successfully.",
    PASSWORD_RESET_SENT: "Password reset instructions sent successfully.",
    PASSWORD_RESET_OK: "Password has been reset successfully.",
    PASSWORD_CHANGED: "Password updated successfully.",
    TWO_FACTOR_SETTINGS_UPDATED:
      "Two-factor authentication settings updated. Verification is still required.",
    TWO_FACTOR_ENROLLMENT_READY:
      "Two-factor verification session created successfully.",
    TWO_FACTOR_CHALLENGE_SENT:
      "Two-factor verification challenge sent successfully.",
    TWO_FACTOR_VERIFIED: "Two-factor method verified successfully.",
    TOKENS_REFRESHED: "Tokens refreshed successfully.",
    PROFILE_FETCHED: "Profile fetched successfully.",
    PROFILE_UPDATED: "Profile updated successfully.",
    USERNAME_AVAILABLE: "Username is available.",
    ONBOARDING_COMPLETE: "Onboarding completed successfully.",
    ROLE_REQUEST_SUBMITTED: "Role change request submitted successfully.",
    ROLE_REQUEST_APPROVED: "Role request approved successfully.",
    ROLE_REQUEST_REJECTED: "Role request rejected successfully.",
    CARDS_LISTED: "Saved cards fetched successfully.",
    CARD_DELETED: "Card removed successfully.",
    CARD_DEFAULT_SET: "Default payment method updated.",
    SECURITY_UPDATED: "Security settings updated.",
    PASSKEY_REGISTERED: "Passkey registered successfully.",
    PRODUCT_CREATED: "Product created successfully.",
    PRODUCT_UPDATED: "Product updated successfully.",
    PRODUCT_MEDIA_ASSETS_UPLOADED:
      "Product media assets uploaded successfully.",
    PRODUCT_FETCHED: "Product fetched successfully.",
    PRODUCTS_FETCHED: "Products fetched successfully.",
    PRODUCT_SUGGESTIONS_FETCHED: "Product suggestions fetched successfully.",
    LIVESTREAM_CREATED: "Livestream created successfully.",
    LIVESTREAM_FETCHED: "Livestream fetched successfully.",
    LIVESTREAMS_FETCHED: "Livestreams fetched successfully.",
    LIVESTREAM_JOINED: "Livestream joined successfully.",
    AUCTION_CREATED: "Auction created successfully.",
    BID_PLACED: "Bid placed successfully.",
    AUCTION_CLOSED: "Auction closed successfully.",
    PLATFORM_SETTINGS_FETCHED: "Platform settings fetched successfully.",
    PLATFORM_SETTINGS_UPDATED: "Platform settings updated successfully.",
    PAYMENT_CAPABILITIES_FETCHED: "Payment capabilities fetched successfully.",
    ORDER_CREATED: "Order created successfully.",
    ORDER_PAID: "Order paid successfully.",
    ORDERS_FETCHED: "Orders fetched successfully.",
    ACCOUNT_RESOLVED: "Bank account resolved successfully.",
    // Notifications
    NOTIFICATION_SENT: "Notification dispatched successfully.",
    USERS_FETCHED: "Users fetched successfully.",
    PROMO_CREATED: "Promo created successfully.",
    PROMO_FETCHED: "Promo fetched successfully.",
    PROMOS_FETCHED: "Promos fetched successfully.",
    PROMO_UPDATED: "Promo updated successfully.",
    PROMO_ATTACHED: "Promo attached to product successfully.",
    PROMO_DETACHED: "Promo detached from product successfully.",
    PROMO_APPROVED: "Promo approved successfully.",
    PROMO_REJECTED: "Promo rejected.",
    ESCROW_HELD: "Payment received and held in escrow.",
    ESCROW_RELEASED: "Escrow funds released to vendor.",
    ESCROW_DISPUTED: "Dispute raised on order.",
    ESCROW_REFUNDED: "Buyer refund initiated.",
  },
  ERRORS: {
    // General
    INTERNAL: "Internal Server Error.",
    NOT_FOUND: "Resource not found.",
    UNAUTHORIZED: "Unauthorized.",
    FORBIDDEN: "Insufficient privileges.",
    // Validation
    VALIDATION_FAILED: "Validation failed.",
    // Roles
    ROLE_CREATION_FAILED: "Failed to create role.",
    ROLES_FETCH_FAILED: "Failed to fetch roles.",
    ROLE_NOT_FOUND: "Role not found.",
    ROLE_REQUEST_NOT_FOUND: "Role change request not found.",
    ROLE_ALREADY_REQUESTED: "A pending role change request already exists.",
    INVALID_CREDENTIALS: "Invalid credentials.",
    REFRESH_TOKEN_INVALID: "Invalid or expired refresh token.",
    OAUTH_INIT_FAILED: "Failed to initiate OAuth.",
    OAUTH_STATE_MISSING: "OAuth state missing from callback.",
    OAUTH_STATE_INVALID: "OAuth state invalid or expired.",
    OAUTH_CALLBACK_FAILED: "Failed to process OAuth callback.",
    PROVIDER_REQUIRED: "roleId and provider are required.",
    EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
    USERNAME_TAKEN: "This username is already taken.",
    USERNAME_REQUIRED: "Username is required for social accounts.",
    USERNAME_INVALID:
      "Username must be 3-30 characters: letters, numbers, underscores, hyphens only.",
    INVALID_ROLE:
      "The provided roleId does not correspond to a valid, active role.",
    REFERRAL_CODE_INVALID:
      "Referral code is invalid or belongs to an inactive account.",
    REGISTER_FAILED: "Failed to create account. Please try again.",
    OTP_INVALID: "Invalid or expired OTP.",
    LOGIN_OTP_RATE_LIMITED:
      "Too many login verification codes have been sent. Please wait before requesting another.",
    EMAIL_VERIFY_FAILED: "Failed to verify email.",
    ONBOARDING_TOKEN_INVALID: "Onboarding token is invalid or expired.",
    PASSWORD_INCORRECT: "Current password is incorrect.",
    PASSWORD_RESET_FAILED: "Failed to send password reset instructions.",
    RESET_TOKEN_INVALID: "Password reset token is invalid or has expired.",
    CHANGE_PASSWORD_FAILED: "Failed to update password.",
    MAGIC_LINK_BANNED_CHANNEL:
      "Magic links cannot be sent via SMS. Please choose email or WhatsApp.",
    TWO_FACTOR_REQUIRED:
      "Two-factor authentication must be enabled before accessing this resource.",
    TWO_FACTOR_ENROLLMENT_INVALID:
      "Two-factor verification session is invalid or has expired.",
    TWO_FACTOR_CHALLENGE_REQUIRED:
      "A verification challenge must be generated before it can be verified.",
    TWO_FACTOR_CHANNEL_UNAVAILABLE:
      "The selected 2FA channel is unavailable for this account.",
    TWO_FACTOR_AUTHENTICATOR_SETUP_REQUIRED:
      "Authenticator enrollment must be started before verification.",
    // Users
    USER_NOT_FOUND: "User not found.",
    USER_FETCH_FAILED: "Failed to fetch users.",
    PROFILE_UPDATE_FAILED: "Failed to update profile.",
    PROFILE_FETCH_FAILED: "Failed to fetch profile.",
    ONBOARDING_FAILED: "Failed to complete onboarding.",
    ONBOARDING_ALREADY_COMPLETE: "Onboarding has already been completed.",
    USERNAME_CHECK_FAILED: "Failed to check username availability.",
    ROLE_REQUEST_FAILED: "Failed to submit role change request.",
    ADMIN_ROLE_ACTION_FAILED: "Failed to process role request.",
    CARD_NOT_FOUND: "The specified card was not found.",
    CARD_DELETE_FAILED: "Failed to remove card.",
    CARD_DEFAULT_FAILED: "Failed to update default card.",
    SECURITY_UPDATE_FAILED: "Failed to update security settings.",
    PASSKEY_REGISTER_FAILED: "Failed to register passkey.",
    PRODUCT_NOT_FOUND: "Product not found.",
    PRODUCT_CREATE_FAILED: "Failed to create product.",
    PRODUCT_UPDATE_FAILED: "Failed to update product.",
    PRODUCT_MEDIA_UPLOAD_FAILED: "Failed to upload product media assets.",
    PRODUCT_FETCH_FAILED: "Failed to fetch product.",
    PRODUCTS_FETCH_FAILED: "Failed to fetch products.",
    PRODUCT_VERSION_CONFLICT:
      "Product was updated by another request. Refresh and try again.",
    PRODUCT_MEDIA_INVALID:
      "Unsupported product media upload. Use images or supported 3D model files.",
    PRODUCT_SUGGESTIONS_FETCH_FAILED: "Failed to fetch product suggestions.",
    LIVESTREAM_CREATE_FAILED: "Failed to create livestream.",
    LIVESTREAM_FETCH_FAILED: "Failed to fetch livestream.",
    LIVESTREAMS_FETCH_FAILED: "Failed to fetch livestreams.",
    LIVESTREAM_NOT_FOUND: "Livestream not found.",
    LIVESTREAM_CONFIG_INVALID:
      "Cloudflare livestream configuration is missing or invalid.",
    LIVESTREAM_ACCESS_DENIED: "You do not have access to this livestream.",
    LIVESTREAM_ENDED: "This livestream has ended.",
    AUCTION_NOT_FOUND: "Auction not found.",
    AUCTION_NOT_OPEN: "Auction is not open for bidding.",
    BID_TOO_LOW: "Bid amount is below the required minimum.",
    PLATFORM_SETTINGS_NOT_FOUND: "Platform settings not found.",
    PAYMENT_CAPABILITIES_FETCH_FAILED: "Failed to fetch payment capabilities.",
    ORDER_NOT_FOUND: "Order not found.",
    ORDER_PAYMENT_FAILED: "Failed to process order payment.",
    ORDER_INVALID_STATE: "Order is not in a payable state.",
    GUEST_COMMENT_FORBIDDEN: "Sign in to comment.",
    LIVESTREAM_PURCHASE_CLOSED: "Livestream purchase window has closed.",
    PRODUCT_IN_LIVE_AUCTION: "This product is in an active live auction.",
    ORDER_PAYMENT_FORBIDDEN: "You are not authorized to pay for this order.",
    PRODUCT_OUT_OF_STOCK:
      "This product is out of stock. Inventory is only reduced after successful payment.",
    UNSUPPORTED_PAYMENT_METHOD: "Unsupported payment method for this checkout.",
    VENDOR_PAYOUT_UNAVAILABLE:
      "Vendor payout details are not configured for this payment method.",
    ACCOUNT_RESOLVE_FAILED:
      "Could not resolve bank account. Please verify details.",
    FILE_TOO_LARGE: "Profile picture exceeds strict 5 MB limit.",
    UPLOAD_FAILED: "Failed to upload file to Cloudinary.",
    PROMO_NOT_FOUND: "Promo not found.",
    PROMO_CREATE_FAILED: "Failed to create promo.",
    PROMO_UPDATE_FAILED: "Failed to update promo.",
    PROMO_ATTACH_FAILED: "Failed to attach promo to product.",
    PROMO_DETACH_FAILED: "Failed to detach promo from product.",
    PROMO_REVIEW_FAILED: "Failed to process promo review.",
    PROMO_CODE_INVALID: "Invalid or expired promo code.",
    ESCROW_NOT_FOUND: "Escrow not found or not in a valid state.",
    ESCROW_RELEASE_FAILED: "Failed to release escrow funds.",
    ESCROW_DISPUTE_FAILED: "Failed to raise dispute.",
    ESCROW_REFUND_FAILED: "Failed to process refund.",
    ESCROW_INVALID_STATE: "Escrow is not in a valid state for this action.",
  },
};


export const SUPPORTED_CURRENCIES = [
  "NGN",
  "USD",
  "EUR",
  "GBP",
  "GHS",
  "KES",
  "ZAR",
  "CAD",
  "AED",
  "XOF",
  "SOL",
  "USDC",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const FIAT_CURRENCIES = [
  "NGN",
  "USD",
  "EUR",
  "GBP",
  "GHS",
  "KES",
  "ZAR",
  "CAD",
  "AED",
  "XOF",
] as const;

export const CRYPTO_CURRENCIES = ["SOL", "USDC"] as const;
export type CryptoCurrency = (typeof CRYPTO_CURRENCIES)[number];

export const isSupportedCurrency = (code: string): code is SupportedCurrency =>
  (SUPPORTED_CURRENCIES as readonly string[]).includes(code.toUpperCase());

export const isCryptoCurrency = (code: string): code is CryptoCurrency =>
  (CRYPTO_CURRENCIES as readonly string[]).includes(code.toUpperCase());

export const CURRENCY_META: Record<
  SupportedCurrency,
  { name: string; symbol: string; decimals: number; type: "fiat" | "crypto" }
> = {
  NGN: { name: "Nigerian Naira", symbol: "₦", decimals: 2, type: "fiat" },
  USD: { name: "US Dollar", symbol: "$", decimals: 2, type: "fiat" },
  EUR: { name: "Euro", symbol: "€", decimals: 2, type: "fiat" },
  GBP: { name: "British Pound", symbol: "£", decimals: 2, type: "fiat" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH₵", decimals: 2, type: "fiat" },
  KES: { name: "Kenyan Shilling", symbol: "KSh", decimals: 2, type: "fiat" },
  ZAR: { name: "South African Rand", symbol: "R", decimals: 2, type: "fiat" },
  CAD: { name: "Canadian Dollar", symbol: "CA$", decimals: 2, type: "fiat" },
  AED: { name: "UAE Dirham", symbol: "د.إ", decimals: 2, type: "fiat" },
  XOF: {
    name: "West African CFA Franc",
    symbol: "CFA",
    decimals: 0,
    type: "fiat",
  },
  SOL: { name: "Solana", symbol: "SOL", decimals: 9, type: "crypto" },
  USDC: {
    name: "USD Coin (Solana)",
    symbol: "USDC",
    decimals: 6,
    type: "crypto",
  },
};

export const CURRENCY_TO_GATEWAYS: Record<
  SupportedCurrency,
  readonly string[]
> = {
  NGN: ["paystack", "flutterwave"],
  GHS: ["flutterwave", "paystack"],
  KES: ["flutterwave", "paystack"],
  ZAR: ["flutterwave", "paystack"],
  XOF: ["flutterwave"],
  USD: ["stripe", "flutterwave"],
  EUR: ["stripe"],
  GBP: ["stripe"],
  CAD: ["stripe"],
  AED: ["stripe"],
  SOL: ["solana"],
  USDC: ["solana"],
};

export const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  NG: "NGN",
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  IE: "EUR",
  CA: "CAD",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  AE: "AED",
  CI: "XOF",
  SN: "XOF",
  ML: "XOF",
  BF: "XOF",
};
