/**
 * ===========================================
 * WalletConnect Pay Integration Library
 * ===========================================
 * 
 * Provides helper functions for generating WalletConnect Pay
 * universal QR codes and deep links.
 * 
 * Note: WalletConnect Pay (now Reown) enables universal payment QR codes
 * that work with any Web3 wallet supporting the WalletConnect protocol.
 * 
 * @see https://docs.reown.com/
 */

import QRCode from "qrcode";
import type {
  Order,
  WalletConnectConfig,
  NetworkId,
  StablecoinSymbol,
} from "./types";
import { getSecrets } from "./secrets";

// ===========================================
// Configuration
// ===========================================

/**
 * Default WalletConnect metadata for the merchant POS
 */
const DEFAULT_METADATA = {
  name: process.env.MERCHANT_NAME || "SablePay Coffee Shop",
  description: "Accept stablecoin payments with ease",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

// Cache for project ID
let cachedProjectId: string | null = null;

/**
 * Get WalletConnect Project ID
 */
async function getProjectId(): Promise<string> {
  if (cachedProjectId) {
    return cachedProjectId;
  }

  // Check environment variable first
  if (process.env.WALLETCONNECT_PROJECT_ID) {
    cachedProjectId = process.env.WALLETCONNECT_PROJECT_ID;
    return cachedProjectId;
  }

  // Get from Secrets Manager
  const secrets = await getSecrets();
  if (!secrets.WALLETCONNECT_PROJECT_ID) {
    throw new Error('WALLETCONNECT_PROJECT_ID not found in secrets');
  }
  const projectId = secrets.WALLETCONNECT_PROJECT_ID;
  cachedProjectId = projectId;
  return projectId;
}

// ===========================================
// Token Contract Addresses
// ===========================================

/**
 * Supported networks configuration
 */
export const SUPPORTED_NETWORKS = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    explorer: "https://etherscan.io",
    icon: "⟠",
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    explorer: "https://polygonscan.com",
    icon: "⬡",
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum",
    chainId: 42161,
    explorer: "https://arbiscan.io",
    icon: "🔵",
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    explorer: "https://optimistic.etherscan.io",
    icon: "🔴",
  },
  base: {
    id: "base",
    name: "Base",
    chainId: 8453,
    explorer: "https://basescan.org",
    icon: "🔷",
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    explorer: "https://snowtrace.io",
    icon: "🔺",
  },
  bsc: {
    id: "bsc",
    name: "BNB Chain",
    chainId: 56,
    explorer: "https://bscscan.com",
    icon: "💛",
  },
} as const;

export type NetworkKey = keyof typeof SUPPORTED_NETWORKS;

/**
 * Supported stablecoins with their configurations
 */
export const SUPPORTED_STABLECOINS = {
  USDC: { symbol: "USDC", name: "USD Coin", decimals: 6, icon: "💵" },
  USDT: { symbol: "USDT", name: "Tether USD", decimals: 6, icon: "💲" },
  DAI: { symbol: "DAI", name: "Dai", decimals: 18, icon: "◈" },
  BUSD: { symbol: "BUSD", name: "Binance USD", decimals: 18, icon: "🟡" },
  FRAX: { symbol: "FRAX", name: "Frax", decimals: 18, icon: "🔷" },
  TUSD: { symbol: "TUSD", name: "TrueUSD", decimals: 18, icon: "🔵" },
  USDP: { symbol: "USDP", name: "Pax Dollar", decimals: 18, icon: "🅿️" },
  GUSD: { symbol: "GUSD", name: "Gemini Dollar", decimals: 2, icon: "🟩" },
  LUSD: { symbol: "LUSD", name: "Liquity USD", decimals: 18, icon: "🟢" },
  sUSD: { symbol: "sUSD", name: "Synthetix USD", decimals: 18, icon: "🟣" },
  PYUSD: { symbol: "PYUSD", name: "PayPal USD", decimals: 6, icon: "🅿️" },
  EURS: { symbol: "EURS", name: "STASIS Euro", decimals: 2, icon: "€" },
  EURT: { symbol: "EURT", name: "Tether Euro", decimals: 6, icon: "€" },
  USDD: { symbol: "USDD", name: "USDD", decimals: 18, icon: "🔶" },
} as const;

export type StablecoinKey = keyof typeof SUPPORTED_STABLECOINS;

/**
 * Comprehensive token contract addresses by network and stablecoin
 */
export const TOKEN_CONTRACTS: Record<NetworkKey, Partial<Record<string, string>>> = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EescdeCB5BC8F2",
    FRAX: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
    TUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
    USDP: "0x8E870D67F660D95d5be530380D0eC0bd388289E1",
    GUSD: "0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd",
    LUSD: "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0",
    sUSD: "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51",
    PYUSD: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
    EURS: "0xdB25f211AB05b1c97D595516F45D7628d50CF763",
    EURT: "0xC581b735A1688071A1746c968e0798D642EDE491",
  },
  polygon: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    FRAX: "0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89",
    TUSD: "0x2e1AD108fF1D8C782fcBbB89AAd783aC49586756",
    EURS: "0xE111178A87A3BFf0c8d18DECBa5798827539Ae99",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    FRAX: "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F",
    LUSD: "0x93b346b6BC2548dA6A1E7d98E9a421B42541425b",
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Native USDC
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    FRAX: "0x2E3D870790dC77A83DD1d18184Acc7439A53f475",
    LUSD: "0xc40F949F8a4e094D1b49a23ea9241D289B7b2819",
    sUSD: "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDC
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
  avalanche: {
    USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Native USDC
    USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    DAI: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
    TUSD: "0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB",
  },
  bsc: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    DAI: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    TUSD: "0x14016E85a25aeb13065688cAFB43044C2ef86784",
    USDD: "0xd17479997F34dd9156Deef8F95A52D81D265be9c",
  },
};

/**
 * Legacy USDC contracts mapping (for backward compatibility)
 */
export const USDC_CONTRACTS: Record<string, string> = {
  "e3c7fdd8-b1fc-4e51-85ae-bb276e075611": TOKEN_CONTRACTS.ethereum.USDC!,
  "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12": TOKEN_CONTRACTS.polygon.USDC!,
  "arbitrum": TOKEN_CONTRACTS.arbitrum.USDC!,
  "optimism": TOKEN_CONTRACTS.optimism.USDC!,
  "base": TOKEN_CONTRACTS.base.USDC!,
  "ethereum": TOKEN_CONTRACTS.ethereum.USDC!,
  "polygon": TOKEN_CONTRACTS.polygon.USDC!,
};

/**
 * Chain IDs for supported networks
 */
export const CHAIN_IDS: Record<string, number> = {
  "e3c7fdd8-b1fc-4e51-85ae-bb276e075611": 1, // Ethereum Mainnet
  "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12": 137, // Polygon
  "arbitrum": 42161,
  "optimism": 10,
  "base": 8453,
  "avalanche": 43114,
  "bsc": 56,
  "ethereum": 1,
  "polygon": 137,
};

// ===========================================
// QR Code Generation
// ===========================================

/**
 * Generate a WalletConnect Pay universal QR code
 * 
 * This creates a QR code that can be scanned by any WalletConnect-compatible
 * wallet to initiate a payment.
 * 
 * For auto-detect mode, generates a universal payment request that accepts
 * the most common stablecoins across multiple networks.
 * 
 * @param order - The order details
 * @param merchantAddress - Merchant's wallet address
 * @returns Object containing QR code data URL and payment URL
 */
export async function generatePaymentQR(
  order: Order,
  merchantAddress: string
): Promise<{
  qrCodeDataUrl: string;
  paymentUrl: string;
  expiresAt: string;
  isAutoDetect: boolean;
  supportedOptions?: { network: string; stablecoin: string; chainId: number }[];
}> {
  const projectId = await getProjectId();
  
  // Check if auto-detect mode
  const rawNetworkId = order.networkId as string;
  const rawStablecoin = order.stablecoin as string;
  const isAutoDetect = rawNetworkId === "auto" || rawStablecoin === "any";
  
  // Determine network and token
  let networkId: NetworkKey = order.networkId as NetworkKey;
  let stablecoin: string = order.stablecoin || "USDC";
  
  // For auto-detect mode, we'll generate a QR for the best default (Base + USDC)
  // but the Mesh link will accept all options
  if (rawNetworkId === "auto" || !SUPPORTED_NETWORKS[networkId]) {
    // Priority: Base (lowest fees) > Polygon > Arbitrum > Optimism
    networkId = "base";
    console.log(`[WalletConnect] Auto-detect network: using Base (lowest fees)`);
  }
  
  if (rawStablecoin === "any") {
    stablecoin = "USDC"; // Default to USDC as most widely held
    console.log(`[WalletConnect] Auto-detect stablecoin: using USDC (most common)`);
  }
  
  // Get network config
  const network = SUPPORTED_NETWORKS[networkId] || SUPPORTED_NETWORKS.base;
  const chainId = network.chainId;
  
  // Get token contract address
  const tokenContracts = TOKEN_CONTRACTS[networkId] || TOKEN_CONTRACTS.base;
  let tokenContract = tokenContracts[stablecoin];
  
  // Fallback to USDC if selected stablecoin not available on this network
  if (!tokenContract) {
    tokenContract = tokenContracts["USDC"];
    stablecoin = "USDC";
    console.log(`[WalletConnect] ${order.stablecoin} not available on ${network.name}, using USDC`);
  }
  
  if (!tokenContract) {
    throw new Error(`No stablecoins available on ${network.name}`);
  }
  
  // Get token decimals
  const tokenConfig = SUPPORTED_STABLECOINS[stablecoin as StablecoinKey];
  const decimals = tokenConfig?.decimals || 6;

  // Convert amount to token units based on decimals
  const tokenAmount = BigInt(Math.floor(order.amount * Math.pow(10, decimals))).toString();

  // Build ERC20 transfer data
  const transferData = buildERC20TransferData(merchantAddress, tokenAmount);

  // Create WalletConnect Pay URL (EIP-681 compatible)
  const paymentUrl = buildPaymentUrl({
    chainId,
    contractAddress: tokenContract,
    merchantAddress,
    amount: tokenAmount,
    orderId: order.orderId,
    projectId,
  });

  console.log(`[WalletConnect] Generated payment URL for ${stablecoin} on ${network.name}: ${paymentUrl}`);
  
  // Build list of supported options for auto-detect mode
  const supportedOptions = isAutoDetect ? buildSupportedOptions(merchantAddress, order.amount) : undefined;
  if (supportedOptions) {
    console.log(`[WalletConnect] Auto-detect mode: ${supportedOptions.length} payment options available`);
  }

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });

  // Set expiration (15 minutes from now)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    qrCodeDataUrl,
    paymentUrl,
    expiresAt,
    isAutoDetect,
    supportedOptions,
  };
}

/**
 * Build a list of all supported payment options for auto-detect mode
 */
function buildSupportedOptions(
  merchantAddress: string,
  amount: number
): { network: string; stablecoin: string; chainId: number }[] {
  const options: { network: string; stablecoin: string; chainId: number }[] = [];
  
  // Priority order for networks (by fees and speed)
  const networkPriority: NetworkKey[] = ["base", "polygon", "arbitrum", "optimism", "avalanche", "bsc", "ethereum"];
  
  for (const networkId of networkPriority) {
    const network = SUPPORTED_NETWORKS[networkId];
    const contracts = TOKEN_CONTRACTS[networkId];
    
    if (!network || !contracts) continue;
    
    for (const [stablecoin, contract] of Object.entries(contracts)) {
      if (contract) {
        options.push({
          network: network.name,
          stablecoin,
          chainId: network.chainId,
        });
      }
    }
  }
  
  return options;
}

// ===========================================
// Payment URL Building
// ===========================================

interface PaymentUrlParams {
  chainId: number;
  contractAddress: string;
  merchantAddress: string;
  amount: string;
  orderId: string;
  projectId: string;
}

/**
 * Build a payment URL following EIP-681 standard
 * 
 * This URL format is supported by most Ethereum wallets and
 * can be used with WalletConnect's universal deep linking.
 * 
 * @param params - Payment URL parameters
 * @returns Payment URL string
 */
function buildPaymentUrl(params: PaymentUrlParams): string {
  const {
    chainId,
    contractAddress,
    merchantAddress,
    amount,
    orderId,
    projectId,
  } = params;

  // EIP-681 format for ERC20 transfer
  // ethereum:<contract_address>@<chain_id>/transfer?address=<recipient>&uint256=<amount>
  const eip681Url = `ethereum:${contractAddress}@${chainId}/transfer?address=${merchantAddress}&uint256=${amount}`;

  // Wrap with WalletConnect universal link for broader compatibility
  // This allows the URL to work with the WalletConnect modal as well
  const wcUniversalLink = `https://react-app.walletconnect.com/wc?uri=${encodeURIComponent(
    eip681Url
  )}&projectId=${projectId}&orderId=${orderId}`;

  // For maximum compatibility, return the EIP-681 URL
  // Wallets that support it will handle the payment directly
  return eip681Url;
}

/**
 * Build ERC20 transfer function data
 * 
 * @param to - Recipient address
 * @param amount - Amount in smallest units (wei for USDC = 6 decimals)
 * @returns Hex-encoded function call data
 */
function buildERC20TransferData(to: string, amount: string): string {
  // Function selector for transfer(address,uint256)
  const functionSelector = "0xa9059cbb";
  
  // Pad address to 32 bytes (remove 0x, pad to 64 chars)
  const paddedAddress = to.replace("0x", "").padStart(64, "0");
  
  // Pad amount to 32 bytes (convert to hex, pad to 64 chars)
  const paddedAmount = BigInt(amount).toString(16).padStart(64, "0");
  
  return `${functionSelector}${paddedAddress}${paddedAmount}`;
}

// ===========================================
// Deep Link Generation
// ===========================================

/**
 * Generate a deep link for specific wallets
 * 
 * @param paymentUrl - The base payment URL
 * @param wallet - Target wallet (metamask, rainbow, etc.)
 * @returns Deep link URL
 */
export function generateWalletDeepLink(
  paymentUrl: string,
  wallet: "metamask" | "rainbow" | "trust" | "coinbase"
): string {
  const encodedUrl = encodeURIComponent(paymentUrl);

  switch (wallet) {
    case "metamask":
      return `https://metamask.app.link/send/${paymentUrl.replace("ethereum:", "")}`;
    case "rainbow":
      return `rainbow://wc?uri=${encodedUrl}`;
    case "trust":
      return `trust://${paymentUrl.replace("ethereum:", "send?")}`;
    case "coinbase":
      return `https://go.cb-w.com/wc?uri=${encodedUrl}`;
    default:
      return paymentUrl;
  }
}

// ===========================================
// Session Management
// ===========================================

/**
 * Get WalletConnect configuration
 * 
 * @returns WalletConnect config object
 */
export async function getWalletConnectConfig(): Promise<WalletConnectConfig> {
  const projectId = await getProjectId();
  
  return {
    projectId,
    metadata: DEFAULT_METADATA,
  };
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Check if a transaction hash is valid
 * 
 * @param hash - Transaction hash to validate
 * @returns true if valid Ethereum transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Generate a unique session ID for WalletConnect
 * 
 * @returns Session ID string
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse a WalletConnect URI to extract connection details
 * 
 * @param uri - WalletConnect URI
 * @returns Parsed URI components
 */
export function parseWalletConnectUri(uri: string): {
  protocol: string;
  topic: string;
  version: number;
  symKey: string;
  relay: string;
} | null {
  try {
    // WC URI format: wc:<topic>@<version>?relay-protocol=<relay>&symKey=<key>
    const match = uri.match(/^wc:([^@]+)@(\d+)\?(.+)$/);
    if (!match) return null;

    const [, topic, version, params] = match;
    const searchParams = new URLSearchParams(params);

    return {
      protocol: "wc",
      topic,
      version: parseInt(version),
      symKey: searchParams.get("symKey") || "",
      relay: searchParams.get("relay-protocol") || "irn",
    };
  } catch {
    return null;
  }
}

/**
 * Calculate the amount with network fees included
 * 
 * @param amount - Base amount in USD
 * @param networkId - Network ID for fee estimation
 * @returns Amount with estimated fees
 */
export function calculateTotalWithFees(
  amount: number,
  networkId: NetworkId
): {
  baseAmount: number;
  estimatedFee: number;
  total: number;
} {
  // Estimated gas fees by network (in USD)
  const feeEstimates: Record<string, number> = {
    "e3c7fdd8-b1fc-4e51-85ae-bb276e075611": 5.0, // Ethereum - higher fees
    "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12": 0.01, // Polygon - very low fees
    "arbitrum": 0.10, // Arbitrum
    "optimism": 0.05, // Optimism
  };

  const estimatedFee = feeEstimates[networkId] || 1.0;

  return {
    baseAmount: amount,
    estimatedFee,
    total: amount + estimatedFee,
  };
}
