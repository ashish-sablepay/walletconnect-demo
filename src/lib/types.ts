/**
 * ===========================================
 * SablePay Merchant POS - TypeScript Types
 * ===========================================
 * 
 * Central type definitions for the entire application.
 * All API responses, database models, and domain types are defined here.
 */

// ===========================================
// Payment Status Types
// ===========================================

/**
 * Possible states for a payment throughout its lifecycle
 */
export type PaymentStatus = 
  | 'pending'      // Order created, awaiting QR scan
  | 'scanning'     // Customer has scanned QR
  | 'authorizing'  // Customer is authorizing in wallet
  | 'processing'   // Payment is being processed
  | 'completed'    // Payment successful
  | 'failed'       // Payment failed
  | 'expired'      // Payment request expired
  | 'cancelled';   // Payment cancelled by merchant/customer

/**
 * Supported blockchain networks for payments
 */
export type NetworkId = 
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'avalanche'
  | 'bsc'
  | 'e3c7fdd8-b1fc-4e51-85ae-bb276e075611'  // Legacy Ethereum Mainnet
  | '7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12'  // Legacy Polygon
  | string;                                   // Allow custom network IDs

/**
 * Supported stablecoins for payment
 */
export type StablecoinSymbol = 'USDC' | 'USDT' | 'DAI' | 'BUSD';

// ===========================================
// Order Types
// ===========================================

/**
 * Order model stored in DynamoDB
 */
export interface Order {
  /** Unique order identifier (UUID) */
  orderId: string;
  
  /** Payment amount in USD (fiat) */
  amount: number;
  
  /** Currency code (always USD for fiat amount) */
  currency: string;
  
  /** Stablecoin used for payment */
  stablecoin: StablecoinSymbol;
  
  /** Merchant wallet address to receive funds */
  merchantWalletAddress: string;
  
  /** Current payment status */
  status: PaymentStatus;
  
  /** Optional description/memo for the order */
  description?: string;
  
  /** Order items (for detailed receipts) */
  items?: OrderItem[];
  
  /** ISO timestamp when order was created */
  createdAt: string;
  
  /** ISO timestamp when order was last updated */
  updatedAt: string;
  
  /** ISO timestamp when order expires */
  expiresAt: string;
  
  /** Blockchain network ID for the payment */
  networkId: NetworkId;
}

/**
 * Individual item in an order
 */
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

// ===========================================
// Payment Status Types
// ===========================================

/**
 * Payment status record stored in DynamoDB
 */
export interface PaymentStatusRecord {
  /** Order ID this payment belongs to */
  orderId: string;
  
  /** Current payment status */
  status: PaymentStatus;
  
  /** Blockchain transaction hash (if available) */
  transactionHash?: string;
  
  /** Block number where transaction was confirmed */
  blockNumber?: number;
  
  /** Wallet address that sent the payment */
  senderAddress?: string;
  
  /** Amount received (in stablecoin) */
  amountReceived?: string;
  
  /** Error message if payment failed */
  errorMessage?: string;
  
  /** Error code if payment failed */
  errorCode?: string;
  
  /** Mesh transfer ID (if using Mesh) */
  meshTransferId?: string;
  
  /** WalletConnect session ID */
  walletConnectSessionId?: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
  
  /** History of status changes */
  statusHistory?: StatusHistoryEntry[];
}

/**
 * Entry in the status history array
 */
export interface StatusHistoryEntry {
  status: PaymentStatus;
  timestamp: string;
  message?: string;
}

// ===========================================
// API Request/Response Types
// ===========================================

/**
 * Request to create a new order
 * POST /api/create-order
 */
export interface CreateOrderRequest {
  /** Payment amount in USD */
  amount: number;
  
  /** Optional order description */
  description?: string;
  
  /** Optional order items */
  items?: OrderItem[];
  
  /** Stablecoin to use (defaults to USDC) */
  stablecoin?: StablecoinSymbol;
  
  /** Network to use (defaults to Ethereum) */
  networkId?: NetworkId;
}

/**
 * Response from create order endpoint
 */
export interface CreateOrderResponse {
  success: boolean;
  order?: Order;
  error?: string;
}

/**
 * Request to generate payment QR code
 * POST /api/generate-qr
 */
export interface GenerateQRRequest {
  /** Order ID to generate QR for */
  orderId: string;
}

/**
 * Response from generate QR endpoint
 */
export interface GenerateQRResponse {
  success: boolean;
  
  /** Base64 encoded QR code image */
  qrCodeDataUrl?: string;
  
  /** Universal deep link URL */
  paymentUrl?: string;
  
  /** Mesh Link token for authentication */
  linkToken?: string;
  
  /** Decoded Mesh Link URL for direct use */
  meshLinkUrl?: string;
  
  /** Expiration time for the QR */
  expiresAt?: string;
  
  error?: string;
}

/**
 * Request to initiate payment transfer
 * POST /api/initiate-payment
 */
export interface InitiatePaymentRequest {
  /** Order ID for this payment */
  orderId: string;
  
  /** Auth token received from Mesh Link */
  authToken: string;
  
  /** Account ID to transfer from */
  accountId: string;
}

/**
 * Response from initiate payment endpoint
 */
export interface InitiatePaymentResponse {
  success: boolean;
  
  /** Transfer ID from Mesh */
  transferId?: string;
  
  /** Preview of the transfer */
  preview?: TransferPreview;
  
  error?: string;
}

/**
 * Preview of a transfer before execution
 */
export interface TransferPreview {
  /** Amount to be sent */
  amount: string;
  
  /** Symbol of the asset */
  symbol: string;
  
  /** Estimated network fee */
  estimatedFee?: string;
  
  /** Total including fees */
  total?: string;
}

/**
 * Request to check payment status
 * GET /api/check-status?orderId=xxx
 */
export interface CheckStatusRequest {
  orderId: string;
}

/**
 * Response from check status endpoint
 */
export interface CheckStatusResponse {
  success: boolean;
  status?: PaymentStatus;
  paymentDetails?: PaymentStatusRecord;
  order?: Order;
  error?: string;
}

// ===========================================
// WalletConnect Types
// ===========================================

/**
 * WalletConnect Pay configuration
 */
export interface WalletConnectConfig {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

/**
 * WalletConnect session data
 */
export interface WalletConnectSession {
  topic: string;
  pairingTopic: string;
  relay: {
    protocol: string;
  };
  expiry: number;
  acknowledged: boolean;
  controller: string;
  namespaces: Record<string, unknown>;
}

// ===========================================
// Mesh API Types
// ===========================================

/**
 * Mesh Link token request
 */
export interface MeshLinkTokenRequest {
  userId: string;
  transferOptions: {
    toAddresses: MeshTransferAddress[];
    amountInFiat: number;
    isInclusiveFeeEnabled?: boolean;
    generatePayLink?: boolean;
  };
  restrictMultipleAccounts?: boolean;
  disableApiKeyGeneration?: boolean;
}

/**
 * Destination address for Mesh transfer
 */
export interface MeshTransferAddress {
  networkId: string;
  symbol: string;
  address: string;
}

/**
 * Mesh Link token response
 */
export interface MeshLinkTokenResponse {
  content: {
    linkToken: string;
  };
  status: 'ok' | 'serverFailure' | 'permissionDenied' | 'badRequest' | 'notFound';
  message?: string;
  errorType?: string;
}

/**
 * Mesh transfer request
 */
export interface MeshTransferRequest {
  fromAuthToken: string;
  fromType: string;
  toAddress: string;
  symbol: string;
  networkId: string;
  amount: string;
  fiatCurrency?: string;
  fiatAmount?: number;
}

/**
 * Mesh transfer response
 */
export interface MeshTransferResponse {
  content: {
    transferId: string;
    status: 'pending' | 'completed' | 'failed';
    transactionHash?: string;
    fromAddress?: string;
    toAddress?: string;
    amount?: string;
    symbol?: string;
  };
  status: string;
  message?: string;
  errorType?: string;
}

// ===========================================
// AWS Configuration Types
// ===========================================

/**
 * Secrets stored in AWS Secrets Manager
 */
export interface AppSecrets {
  MESH_CLIENT_ID: string;
  MESH_CLIENT_SECRET: string;
  WALLETCONNECT_PROJECT_ID: string;
  MERCHANT_WALLET_ADDRESS: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  aws: {
    region: string;
    ordersTableName: string;
    paymentStatusTableName: string;
    secretsName: string;
  };
  mesh: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
  };
  walletConnect: {
    projectId: string;
  };
  merchant: {
    walletAddress: string;
    name: string;
  };
  payment: {
    defaultNetworkId: NetworkId;
    defaultStablecoin: StablecoinSymbol;
    orderExpirationMinutes: number;
  };
}

// ===========================================
// UI State Types
// ===========================================

/**
 * POS component state
 */
export interface POSState {
  /** Current order being processed */
  currentOrder: Order | null;
  
  /** QR code data URL for display */
  qrCodeDataUrl: string | null;
  
  /** Payment URL for deep linking */
  paymentUrl: string | null;
  
  /** Current payment status */
  paymentStatus: PaymentStatus;
  
  /** Transaction hash after successful payment */
  transactionHash: string | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error message */
  error: string | null;
}

/**
 * Toast notification type
 */
export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

// ===========================================
// Utility Types
// ===========================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  lastKey?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  lastKey?: string;
  hasMore: boolean;
}
