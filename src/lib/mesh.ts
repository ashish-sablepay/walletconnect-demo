/**
 * ===========================================
 * Mesh API Client Library
 * ===========================================
 * 
 * Provides helper functions for interacting with Mesh APIs.
 * Handles authentication, link tokens, and transfers.
 * 
 * Supports all major stablecoins across multiple networks.
 * 
 * @see https://docs.meshconnect.com/api-reference
 */

import type {
  MeshLinkTokenRequest,
  MeshLinkTokenResponse,
  MeshTransferRequest,
  MeshTransferResponse,
  MeshTransferAddress,
  NetworkId,
  StablecoinSymbol,
} from "./types";
import { getSecrets } from "./secrets";

// ===========================================
// Configuration
// ===========================================

const MESH_API_URL =
  process.env.MESH_API_URL || "https://integration-api.meshconnect.com";

// Cache for credentials
let cachedCredentials: { clientId: string; clientSecret: string } | null = null;

/**
 * Get Mesh API credentials from Secrets Manager
 */
async function getMeshCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Check environment variables first (for local development)
  if (process.env.MESH_CLIENT_ID && process.env.MESH_CLIENT_SECRET) {
    cachedCredentials = {
      clientId: process.env.MESH_CLIENT_ID,
      clientSecret: process.env.MESH_CLIENT_SECRET,
    };
    return cachedCredentials;
  }

  // Get from Secrets Manager in production
  const secrets = await getSecrets();
  cachedCredentials = {
    clientId: secrets.MESH_CLIENT_ID,
    clientSecret: secrets.MESH_CLIENT_SECRET,
  };
  return cachedCredentials;
}

// ===========================================
// Mesh Network IDs (from Mesh API docs)
// ===========================================

/**
 * Mesh Network ID mapping for supported chains
 * These are the official Mesh network identifiers from GET /api/v1/transfers/managed/networks
 * 
 * Only including networks that are verified to work with Mesh API.
 * Use GET /api/v1/transfers/managed/networks to get the full list.
 */
export const MESH_NETWORK_IDS: Record<string, string> = {
  // Verified network IDs from Mesh API
  ethereum: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
  polygon: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
  // Note: Add more networks after verifying their IDs from Mesh API
  // Call GET /api/v1/transfers/managed/networks to get current network list
};

// Legacy mapping for backward compatibility
export const NETWORK_IDS = MESH_NETWORK_IDS;

/**
 * All supported stablecoins that Mesh can handle
 */
export const SUPPORTED_STABLECOINS = [
  "USDC",   // USD Coin - most widely supported
  "USDT",   // Tether - high liquidity
  "DAI",    // MakerDAO DAI - decentralized
  "BUSD",   // Binance USD
  "FRAX",   // Frax - algorithmic
  "TUSD",   // TrueUSD
  "USDP",   // Pax Dollar
  "GUSD",   // Gemini Dollar
  "LUSD",   // Liquity USD
  "sUSD",   // Synthetix USD
  "EURS",   // STASIS Euro
  "EURT",   // Tether Euro
  "USDD",   // USDD
  "PYUSD",  // PayPal USD
] as const;

/**
 * Verified networks with confirmed Mesh network IDs
 * Only include networks that have verified UUIDs in MESH_NETWORK_IDS
 */
export const VERIFIED_NETWORKS = ["ethereum", "polygon"];

/**
 * Stablecoin availability per network
 * Only including verified networks to avoid "Network not found" errors
 * 
 * Note: More networks can be added after verifying their IDs from:
 * GET /api/v1/transfers/managed/networks
 */
export const STABLECOIN_NETWORKS: Record<string, string[]> = {
  // Only including verified networks: ethereum, polygon
  USDC: ["ethereum", "polygon"],
  USDT: ["ethereum", "polygon"],
  DAI: ["ethereum", "polygon"],
  BUSD: ["ethereum"],
  FRAX: ["ethereum", "polygon"],
  TUSD: ["ethereum", "polygon"],
  USDP: ["ethereum"],
  GUSD: ["ethereum"],
  LUSD: ["ethereum"],
  sUSD: ["ethereum"],
  EURS: ["ethereum", "polygon"],
  EURT: ["ethereum"],
  USDD: ["ethereum"],
  PYUSD: ["ethereum"],
};

/**
 * Get network name from ID
 */
export function getNetworkName(networkId: string): string {
  const entry = Object.entries(MESH_NETWORK_IDS).find(([, id]) => id === networkId);
  return entry ? entry[0].charAt(0).toUpperCase() + entry[0].slice(1) : "Unknown Network";
}

/**
 * Get Mesh network ID from our internal network ID
 */
export function getMeshNetworkId(networkId: string): string {
  // If it's already a Mesh UUID, return it
  if (networkId.includes("-")) {
    return networkId;
  }
  // Otherwise, look it up
  return MESH_NETWORK_IDS[networkId.toLowerCase()] || MESH_NETWORK_IDS.ethereum;
}

/**
 * Get all networks that support a given stablecoin
 */
export function getNetworksForStablecoin(symbol: string): string[] {
  return STABLECOIN_NETWORKS[symbol.toUpperCase()] || ["ethereum", "polygon"];
}

// ===========================================
// Link Token Operations
// ===========================================

/**
 * Generate a Mesh Link token for customer authentication
 * 
 * This token allows customers to connect their wallets/exchanges
 * and authorize transfers through the Mesh Link widget.
 * 
 * When "auto" mode is used, it generates addresses for ALL supported
 * stablecoins across ALL networks, giving maximum flexibility to the customer.
 * 
 * @param userId - Unique identifier for the customer
 * @param merchantAddress - Merchant's wallet address to receive funds
 * @param amountInFiat - Amount in USD to transfer
 * @param symbol - Stablecoin symbol or "any" for all stablecoins
 * @param networkId - Network ID or "auto" for all networks
 * @returns Link token response containing the token URL
 */
export async function generateLinkToken(
  userId: string,
  merchantAddress: string,
  amountInFiat: number,
  symbol: StablecoinSymbol | string = "USDC",
  networkId: NetworkId | string = "auto"
): Promise<MeshLinkTokenResponse> {
  const credentials = await getMeshCredentials();

  // Build transfer destination addresses
  const toAddresses: MeshTransferAddress[] = buildTransferAddresses(
    merchantAddress,
    symbol,
    networkId
  );

  console.log(`[Mesh] Generated ${toAddresses.length} transfer addresses for flexibility`);

  const requestBody: MeshLinkTokenRequest = {
    userId: userId,
    transferOptions: {
      toAddresses: toAddresses,
      amountInFiat: amountInFiat,
      isInclusiveFeeEnabled: false, // Customer pays network fees separately
      // Note: generatePayLink requires special enablement in Mesh dashboard
      // If you want shareable payment links, enable PayLink in your Mesh settings
    },
    restrictMultipleAccounts: true, // Only allow one account per session
    disableApiKeyGeneration: true, // Don't allow API key generation
  };

  console.log(`[Mesh] Generating link token for user: ${userId}`);
  console.log(`[Mesh] Transfer amount: $${amountInFiat}`);
  console.log(`[Mesh] Accepted: ${symbol === "any" ? "All stablecoins" : symbol} on ${networkId === "auto" ? "all networks" : networkId}`);

  try {
    const response = await fetch(`${MESH_API_URL}/api/v1/linktoken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": credentials.clientId,
        "X-Client-Secret": credentials.clientSecret,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mesh] Link token API error: ${response.status}`, errorText);
      throw new Error(`Mesh API error: ${response.status} - ${errorText}`);
    }

    const data: MeshLinkTokenResponse = await response.json();
    
    if (data.status !== "ok") {
      console.error(`[Mesh] Link token error:`, data.message);
      throw new Error(data.message || "Failed to generate link token");
    }

    console.log(`[Mesh] Link token generated successfully`);
    return data;
  } catch (error) {
    console.error(`[Mesh] Failed to generate link token:`, error);
    throw error;
  }
}

/**
 * Build transfer addresses based on stablecoin and network preferences
 * 
 * This function creates a list of transfer destinations using ONLY
 * verified Mesh network IDs to avoid "Network not found" errors.
 */
function buildTransferAddresses(
  merchantAddress: string,
  symbol: string,
  networkId: string
): MeshTransferAddress[] {
  const addresses: MeshTransferAddress[] = [];
  
  // Determine which stablecoins to include
  const stablecoinsToUse = symbol === "any" || symbol === "auto"
    ? ["USDC", "USDT", "DAI"] // Most common, available on verified networks
    : [symbol.toUpperCase()];
  
  // Determine which networks to include
  const isAutoNetwork = networkId === "auto" || !networkId;
  
  for (const coin of stablecoinsToUse) {
    const availableNetworks = STABLECOIN_NETWORKS[coin] || ["ethereum", "polygon"];
    
    for (const network of availableNetworks) {
      // Only use networks that have verified Mesh IDs
      if (!VERIFIED_NETWORKS.includes(network)) {
        console.log(`[Mesh] Skipping unverified network: ${network}`);
        continue;
      }
      
      // If specific network requested, only use that network
      if (!isAutoNetwork) {
        const requestedNetwork = networkId.toLowerCase();
        if (network !== requestedNetwork) {
          continue;
        }
      }
      
      const meshNetworkId = MESH_NETWORK_IDS[network];
      if (meshNetworkId) {
        addresses.push({
          networkId: meshNetworkId,
          symbol: coin,
          address: merchantAddress,
        });
        console.log(`[Mesh] Added: ${coin} on ${network} (${meshNetworkId})`);
      }
    }
  }
  
  // Ensure we have at least one address (fallback to USDC on Ethereum)
  if (addresses.length === 0) {
    console.log(`[Mesh] No addresses generated, using fallback: USDC on Ethereum`);
    addresses.push({
      networkId: MESH_NETWORK_IDS.ethereum,
      symbol: "USDC",
      address: merchantAddress,
    });
  }
  
  console.log(`[Mesh] Total transfer addresses: ${addresses.length}`);
  
  return addresses;
}

// ===========================================
// Transfer Operations
// ===========================================

/**
 * Execute a transfer from customer's connected account to merchant
 * 
 * This is called after the customer has authenticated via Mesh Link
 * and authorized the transfer.
 * 
 * @param params - Transfer parameters
 * @returns Transfer response with status and transaction details
 */
export async function executeTransfer(
  params: MeshTransferRequest
): Promise<MeshTransferResponse> {
  const credentials = await getMeshCredentials();

  console.log(`[Mesh] Executing transfer:`);
  console.log(`  - Amount: ${params.amount} ${params.symbol}`);
  console.log(`  - To: ${params.toAddress}`);
  console.log(`  - Network: ${params.networkId}`);

  try {
    const response = await fetch(`${MESH_API_URL}/api/v1/transfers/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": credentials.clientId,
        "X-Client-Secret": credentials.clientSecret,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mesh] Transfer API error: ${response.status}`, errorText);
      throw new Error(`Mesh transfer error: ${response.status} - ${errorText}`);
    }

    const data: MeshTransferResponse = await response.json();
    
    console.log(`[Mesh] Transfer response:`, data.status);
    return data;
  } catch (error) {
    console.error(`[Mesh] Failed to execute transfer:`, error);
    throw error;
  }
}

/**
 * Get transfer status
 * 
 * @param transferId - The transfer ID to check
 * @returns Transfer response with current status
 */
export async function getTransferStatus(
  transferId: string
): Promise<MeshTransferResponse> {
  const credentials = await getMeshCredentials();

  try {
    const response = await fetch(
      `${MESH_API_URL}/api/v1/transfers/${transferId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": credentials.clientId,
          "X-Client-Secret": credentials.clientSecret,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mesh] Get transfer status error: ${response.status}`, errorText);
      throw new Error(`Mesh API error: ${response.status} - ${errorText}`);
    }

    const data: MeshTransferResponse = await response.json();
    return data;
  } catch (error) {
    console.error(`[Mesh] Failed to get transfer status:`, error);
    throw error;
  }
}

// ===========================================
// Preview Transfer
// ===========================================

/**
 * Preview a transfer to get estimated fees and amounts
 * 
 * @param params - Transfer parameters
 * @returns Preview with fees and totals
 */
export async function previewTransfer(
  params: Omit<MeshTransferRequest, "fromAuthToken">
): Promise<{
  amount: string;
  fee: string;
  total: string;
  symbol: string;
}> {
  const credentials = await getMeshCredentials();

  try {
    const response = await fetch(`${MESH_API_URL}/api/v1/transfers/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": credentials.clientId,
        "X-Client-Secret": credentials.clientSecret,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mesh] Preview transfer error: ${response.status}`, errorText);
      throw new Error(`Mesh API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      amount: data.content?.amount || params.amount,
      fee: data.content?.fee || "0",
      total: data.content?.total || params.amount,
      symbol: params.symbol,
    };
  } catch (error) {
    console.error(`[Mesh] Failed to preview transfer:`, error);
    throw error;
  }
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Decode a Mesh Link token to get the embedded URL
 * 
 * @param linkToken - Base64 encoded link token
 * @returns Decoded URL string
 */
export function decodeLinkToken(linkToken: string): string {
  try {
    return Buffer.from(linkToken, "base64").toString("utf-8");
  } catch (error) {
    console.error("[Mesh] Failed to decode link token:", error);
    return linkToken;
  }
}

/**
 * Validate that the transfer amount is within acceptable limits
 * 
 * @param amount - Amount in USD
 * @returns true if amount is valid
 */
export function isValidTransferAmount(amount: number): boolean {
  const MIN_AMOUNT = 0.01; // Minimum $0.01
  const MAX_AMOUNT = 10000; // Maximum $10,000 per transaction
  return amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
}

/**
 * Format amount for display with proper decimals
 * 
 * @param amount - Amount as string or number
 * @param decimals - Number of decimal places
 * @returns Formatted amount string
 */
export function formatAmount(
  amount: string | number,
  decimals: number = 2
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return num.toFixed(decimals);
}
