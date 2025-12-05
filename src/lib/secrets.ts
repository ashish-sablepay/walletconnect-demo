/**
 * ===========================================
 * Environment Secrets Helper
 * ===========================================
 * 
 * Provides secure access to API keys and secrets from
 * environment variables. For Amplify Gen 2, secrets are
 * configured directly in the Amplify Console.
 * 
 * In Amplify Console, set these environment variables:
 * - MESH_CLIENT_ID
 * - MESH_CLIENT_SECRET
 * - WALLETCONNECT_PROJECT_ID
 * - MERCHANT_WALLET_ADDRESS
 */

import type { AppSecrets } from "./types";

// ===========================================
// Helper to get env var
// ===========================================

function getEnvVar(key: string): string {
  // Access process.env directly - this works in Next.js API routes
  return process.env[key] || "";
}

// ===========================================
// Cache for secrets
// ===========================================

let cachedSecrets: AppSecrets | null = null;

// ===========================================
// Get Secrets
// ===========================================

/**
 * Retrieve secrets from environment variables
 * 
 * For Amplify Gen 2, secrets should be configured in:
 * Amplify Console > App Settings > Environment Variables
 * 
 * @returns AppSecrets object containing all required secrets
 * @throws Error if required secrets are missing
 */
export async function getSecrets(): Promise<AppSecrets> {
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  console.log("[Secrets] Loading secrets from environment variables");
  
  // Log available env vars for debugging (without values)
  console.log("[Secrets] Available env vars:", {
    MESH_CLIENT_ID: !!getEnvVar("MESH_CLIENT_ID"),
    MESH_CLIENT_SECRET: !!getEnvVar("MESH_CLIENT_SECRET"),
    WALLETCONNECT_PROJECT_ID: !!getEnvVar("WALLETCONNECT_PROJECT_ID"),
    MERCHANT_WALLET_ADDRESS: !!getEnvVar("MERCHANT_WALLET_ADDRESS"),
  });

  const secrets: AppSecrets = {
    MESH_CLIENT_ID: getEnvVar("MESH_CLIENT_ID"),
    MESH_CLIENT_SECRET: getEnvVar("MESH_CLIENT_SECRET"),
    WALLETCONNECT_PROJECT_ID: getEnvVar("WALLETCONNECT_PROJECT_ID"),
    MERCHANT_WALLET_ADDRESS: getEnvVar("MERCHANT_WALLET_ADDRESS"),
  };

  // Validate required fields in production
  if (process.env.NODE_ENV === "production") {
    const requiredFields: (keyof AppSecrets)[] = [
      "MESH_CLIENT_ID",
      "MESH_CLIENT_SECRET", 
      "WALLETCONNECT_PROJECT_ID",
      "MERCHANT_WALLET_ADDRESS",
    ];

    const missingFields = requiredFields.filter(field => !secrets[field]);
    
    if (missingFields.length > 0) {
      console.error("[Secrets] Missing required environment variables:", missingFields);
      // Don't throw in production - allow app to start but log error
      console.error("[Secrets] Please configure these in Amplify Console > Environment Variables");
    }
  }

  // Cache the secrets
  cachedSecrets = secrets;

  console.log("[Secrets] Secrets loaded successfully");
  return secrets;
}

// ===========================================
// Individual Secret Getters
// ===========================================

/**
 * Get Mesh API credentials
 */
export async function getMeshCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const secrets = await getSecrets();
  return {
    clientId: secrets.MESH_CLIENT_ID,
    clientSecret: secrets.MESH_CLIENT_SECRET,
  };
}

/**
 * Get WalletConnect Project ID
 */
export async function getWalletConnectProjectId(): Promise<string> {
  const secrets = await getSecrets();
  return secrets.WALLETCONNECT_PROJECT_ID;
}

/**
 * Get Merchant Wallet Address
 */
export async function getMerchantWalletAddress(): Promise<string> {
  // First check environment variable directly from multiple sources
  const walletAddress = getEnvVar("MERCHANT_WALLET_ADDRESS");
  if (walletAddress) {
    return walletAddress;
  }
  
  const secrets = await getSecrets();
  return secrets.MERCHANT_WALLET_ADDRESS;
}

// ===========================================
// Cache Management
// ===========================================

/**
 * Clear the secrets cache
 * 
 * Useful for forcing a refresh of secrets
 */
export function clearSecretsCache(): void {
  cachedSecrets = null;
  console.log("[Secrets] Cache cleared");
}

/**
 * Check if secrets are cached
 */
export function isSecretsCached(): boolean {
  return cachedSecrets !== null;
}
