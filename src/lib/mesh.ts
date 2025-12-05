/**
 * ===========================================
 * Mesh API Client Library
 * ===========================================
 * 
 * Provides helper functions for interacting with Mesh APIs.
 * Handles authentication, link tokens, and transfers.
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
// Network Configuration
// ===========================================

/**
 * Network ID mapping for supported chains
 */
export const NETWORK_IDS: Record<string, NetworkId> = {
  ETHEREUM: "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
  POLYGON: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
  ARBITRUM: "e3c7fdd8-b1fc-4e51-85ae-bb276e075612", // Example
  OPTIMISM: "e3c7fdd8-b1fc-4e51-85ae-bb276e075613", // Example
};

/**
 * Get network name from ID
 */
export function getNetworkName(networkId: NetworkId): string {
  const entry = Object.entries(NETWORK_IDS).find(([, id]) => id === networkId);
  return entry ? entry[0] : "Unknown Network";
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
 * @param userId - Unique identifier for the customer
 * @param merchantAddress - Merchant's wallet address to receive funds
 * @param amountInFiat - Amount in USD to transfer
 * @param symbol - Stablecoin symbol (default: USDC)
 * @param networkId - Network ID (default: Ethereum)
 * @returns Link token response containing the token URL
 */
export async function generateLinkToken(
  userId: string,
  merchantAddress: string,
  amountInFiat: number,
  symbol: StablecoinSymbol = "USDC",
  networkId: NetworkId = NETWORK_IDS.ETHEREUM
): Promise<MeshLinkTokenResponse> {
  const credentials = await getMeshCredentials();

  // Build transfer destination addresses
  // Support multiple networks for flexibility
  const toAddresses: MeshTransferAddress[] = [
    {
      networkId: networkId,
      symbol: symbol,
      address: merchantAddress,
    },
  ];

  // Also add Polygon as an option if using Ethereum
  if (networkId === NETWORK_IDS.ETHEREUM) {
    toAddresses.push({
      networkId: NETWORK_IDS.POLYGON,
      symbol: symbol,
      address: merchantAddress,
    });
  }

  const requestBody: MeshLinkTokenRequest = {
    userId: userId,
    transferOptions: {
      toAddresses: toAddresses,
      amountInFiat: amountInFiat,
      isInclusiveFeeEnabled: false, // Customer pays network fees separately
      generatePayLink: true, // Generate a shareable payment link
    },
    restrictMultipleAccounts: true, // Only allow one account per session
    disableApiKeyGeneration: true, // Don't allow API key generation
  };

  console.log(`[Mesh] Generating link token for user: ${userId}`);
  console.log(`[Mesh] Transfer amount: $${amountInFiat} ${symbol}`);

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
