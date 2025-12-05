/**
 * ===========================================
 * AWS Secrets Manager Helper
 * ===========================================
 * 
 * Provides secure access to API keys and secrets stored
 * in AWS Secrets Manager.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type { AppSecrets } from "./types";

// ===========================================
// Configuration
// ===========================================

const SECRETS_NAME = process.env.AWS_SECRETS_NAME || "sablepay/api-keys";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// ===========================================
// Secrets Client
// ===========================================

/**
 * Secrets Manager client instance
 */
const secretsClient = new SecretsManagerClient({
  region: AWS_REGION,
});

// Cache for secrets to avoid repeated API calls
let cachedSecrets: AppSecrets | null = null;
let cacheExpiresAt: number = 0;

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

// ===========================================
// Get Secrets
// ===========================================

/**
 * Retrieve secrets from AWS Secrets Manager
 * 
 * Secrets are cached for 5 minutes to reduce API calls.
 * In development, falls back to environment variables.
 * 
 * @returns AppSecrets object containing all required secrets
 * @throws Error if secrets cannot be retrieved
 */
export async function getSecrets(): Promise<AppSecrets> {
  // Check if cache is still valid
  if (cachedSecrets && Date.now() < cacheExpiresAt) {
    console.log("[Secrets] Using cached secrets");
    return cachedSecrets;
  }

  // In development, use environment variables directly
  if (process.env.NODE_ENV === "development" || process.env.USE_MOCK_MODE === "true") {
    console.log("[Secrets] Using environment variables (development mode)");
    return {
      MESH_CLIENT_ID: process.env.MESH_CLIENT_ID || "",
      MESH_CLIENT_SECRET: process.env.MESH_CLIENT_SECRET || "",
      WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
      MERCHANT_WALLET_ADDRESS: process.env.MERCHANT_WALLET_ADDRESS || "",
    };
  }

  console.log(`[Secrets] Fetching secrets from AWS Secrets Manager: ${SECRETS_NAME}`);

  try {
    const command = new GetSecretValueCommand({
      SecretId: SECRETS_NAME,
    });

    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    // Parse the JSON secret
    const secrets = JSON.parse(response.SecretString) as AppSecrets;

    // Validate required fields
    const requiredFields: (keyof AppSecrets)[] = [
      "MESH_CLIENT_ID",
      "MESH_CLIENT_SECRET",
      "WALLETCONNECT_PROJECT_ID",
      "MERCHANT_WALLET_ADDRESS",
    ];

    for (const field of requiredFields) {
      if (!secrets[field]) {
        throw new Error(`Missing required secret: ${field}`);
      }
    }

    // Update cache
    cachedSecrets = secrets;
    cacheExpiresAt = Date.now() + CACHE_DURATION_MS;

    console.log("[Secrets] Successfully retrieved secrets");
    return secrets;
  } catch (error) {
    console.error("[Secrets] Failed to retrieve secrets:", error);
    
    // In case of error, try to use environment variables as fallback
    const fallbackSecrets: AppSecrets = {
      MESH_CLIENT_ID: process.env.MESH_CLIENT_ID || "",
      MESH_CLIENT_SECRET: process.env.MESH_CLIENT_SECRET || "",
      WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
      MERCHANT_WALLET_ADDRESS: process.env.MERCHANT_WALLET_ADDRESS || "",
    };

    // Check if fallback has valid values
    if (fallbackSecrets.MESH_CLIENT_ID && fallbackSecrets.WALLETCONNECT_PROJECT_ID) {
      console.log("[Secrets] Using environment variable fallback");
      return fallbackSecrets;
    }

    throw new Error(`Failed to retrieve secrets: ${(error as Error).message}`);
  }
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
  // First check environment variable
  if (process.env.MERCHANT_WALLET_ADDRESS) {
    return process.env.MERCHANT_WALLET_ADDRESS;
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
  cacheExpiresAt = 0;
  console.log("[Secrets] Cache cleared");
}

/**
 * Check if secrets are cached
 */
export function isSecretsCached(): boolean {
  return cachedSecrets !== null && Date.now() < cacheExpiresAt;
}
