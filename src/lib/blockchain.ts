/**
 * ===========================================
 * Blockchain Transaction Monitoring
 * ===========================================
 * 
 * Monitors for incoming stablecoin transfers to merchant addresses.
 * Used to detect payments made via WalletConnect QR codes.
 * 
 * This provides a fallback mechanism when Mesh webhooks aren't available
 * (e.g., for direct wallet-to-wallet transfers via WalletConnect).
 */

import { TOKEN_CONTRACTS, SUPPORTED_NETWORKS } from "./walletconnect";

// ===========================================
// RPC Endpoints (Public, rate-limited)
// ===========================================

const RPC_ENDPOINTS: Record<string, string> = {
  ethereum: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  polygon: process.env.POLYGON_RPC_URL || "https://polygon.llamarpc.com",
  arbitrum: process.env.ARBITRUM_RPC_URL || "https://arbitrum.llamarpc.com",
  optimism: process.env.OPTIMISM_RPC_URL || "https://optimism.llamarpc.com",
  base: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
  avalanche: process.env.AVALANCHE_RPC_URL || "https://avalanche.llamarpc.com",
  bsc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
};

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ===========================================
// Types
// ===========================================

export interface TransferEvent {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
  networkId: string;
  timestamp?: number;
}

export interface MonitoringResult {
  found: boolean;
  transfer?: TransferEvent;
  error?: string;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Make a JSON-RPC call to an Ethereum node
 */
async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }
  return data.result;
}

/**
 * Get the current block number
 */
async function getBlockNumber(networkId: string): Promise<number> {
  const rpcUrl = RPC_ENDPOINTS[networkId];
  if (!rpcUrl) throw new Error(`No RPC endpoint for ${networkId}`);
  
  const result = await rpcCall(rpcUrl, "eth_blockNumber", []);
  return parseInt(result as string, 16);
}

/**
 * Pad address to 32 bytes for event log filtering
 */
function padAddress(address: string): string {
  return "0x" + address.toLowerCase().replace("0x", "").padStart(64, "0");
}

/**
 * Parse amount from hex to decimal string
 */
function parseAmount(hexAmount: string, decimals: number): string {
  const raw = BigInt(hexAmount);
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

/**
 * Get token symbol from address
 */
function getTokenSymbol(tokenAddress: string, networkId: string): string {
  const contracts = TOKEN_CONTRACTS[networkId as keyof typeof TOKEN_CONTRACTS];
  if (!contracts) return "UNKNOWN";
  
  const entry = Object.entries(contracts).find(
    ([, addr]) => addr?.toLowerCase() === tokenAddress.toLowerCase()
  );
  return entry ? entry[0] : "UNKNOWN";
}

// ===========================================
// Main Monitoring Functions
// ===========================================

/**
 * Check for recent stablecoin transfers to a specific address
 * 
 * @param merchantAddress - The address to check for incoming transfers
 * @param networkId - The network to check (ethereum, polygon, etc.)
 * @param fromBlock - Start block (default: last 100 blocks)
 * @param expectedAmount - Optional: filter by expected amount
 * @returns MonitoringResult with transfer details if found
 */
export async function checkForTransfers(
  merchantAddress: string,
  networkId: string,
  fromBlock?: number,
  expectedAmount?: number
): Promise<MonitoringResult> {
  try {
    const rpcUrl = RPC_ENDPOINTS[networkId];
    if (!rpcUrl) {
      return { found: false, error: `Unsupported network: ${networkId}` };
    }

    // Get current block
    const currentBlock = await getBlockNumber(networkId);
    const startBlock = fromBlock || currentBlock - 100; // Last ~100 blocks

    // Get stablecoin contracts for this network
    const contracts = TOKEN_CONTRACTS[networkId as keyof typeof TOKEN_CONTRACTS];
    if (!contracts) {
      return { found: false, error: `No token contracts for ${networkId}` };
    }

    // Check each stablecoin contract
    for (const [symbol, tokenAddress] of Object.entries(contracts)) {
      if (!tokenAddress) continue;

      try {
        // Query Transfer events where `to` is the merchant address
        const logs = await rpcCall(rpcUrl, "eth_getLogs", [
          {
            fromBlock: "0x" + startBlock.toString(16),
            toBlock: "latest",
            address: tokenAddress,
            topics: [
              TRANSFER_EVENT_SIGNATURE,
              null, // from (any)
              padAddress(merchantAddress), // to (merchant)
            ],
          },
        ]) as Array<{
          transactionHash: string;
          blockNumber: string;
          topics: string[];
          data: string;
        }>;

        if (logs && logs.length > 0) {
          // Get the most recent transfer
          const latestLog = logs[logs.length - 1];
          
          // Determine decimals (most stablecoins use 6, DAI uses 18)
          const decimals = symbol === "DAI" ? 18 : 6;
          const amount = parseAmount(latestLog.data, decimals);
          
          // If expected amount specified, check if it matches (with small tolerance)
          if (expectedAmount !== undefined) {
            const parsedAmount = parseFloat(amount);
            const tolerance = expectedAmount * 0.01; // 1% tolerance
            if (Math.abs(parsedAmount - expectedAmount) > tolerance) {
              continue; // Amount doesn't match, check next token
            }
          }

          const transfer: TransferEvent = {
            transactionHash: latestLog.transactionHash,
            blockNumber: parseInt(latestLog.blockNumber, 16),
            from: "0x" + latestLog.topics[1].slice(26), // Extract address from padded topic
            to: merchantAddress,
            amount,
            tokenAddress,
            tokenSymbol: symbol,
            networkId,
          };

          console.log(`[Blockchain] Found transfer: ${amount} ${symbol} on ${networkId}`);
          return { found: true, transfer };
        }
      } catch (tokenError) {
        console.warn(`[Blockchain] Error checking ${symbol} on ${networkId}:`, tokenError);
        continue;
      }
    }

    return { found: false };
  } catch (error) {
    console.error(`[Blockchain] Error monitoring ${networkId}:`, error);
    return { found: false, error: (error as Error).message };
  }
}

/**
 * Check multiple networks for incoming transfers
 */
export async function checkAllNetworksForTransfers(
  merchantAddress: string,
  expectedAmount?: number,
  preferredNetworkId?: string
): Promise<MonitoringResult> {
  // If preferred network specified, check it first
  const networks = preferredNetworkId
    ? [preferredNetworkId, ...Object.keys(RPC_ENDPOINTS).filter(n => n !== preferredNetworkId)]
    : Object.keys(RPC_ENDPOINTS);

  for (const networkId of networks) {
    const result = await checkForTransfers(
      merchantAddress,
      networkId,
      undefined,
      expectedAmount
    );
    
    if (result.found) {
      return result;
    }
  }

  return { found: false };
}

/**
 * Get transaction receipt to verify confirmation
 */
export async function getTransactionStatus(
  transactionHash: string,
  networkId: string
): Promise<{ confirmed: boolean; blockNumber?: number; status?: boolean }> {
  try {
    const rpcUrl = RPC_ENDPOINTS[networkId];
    if (!rpcUrl) {
      return { confirmed: false };
    }

    const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [transactionHash]) as {
      blockNumber: string;
      status: string;
    } | null;

    if (!receipt) {
      return { confirmed: false };
    }

    return {
      confirmed: true,
      blockNumber: parseInt(receipt.blockNumber, 16),
      status: receipt.status === "0x1",
    };
  } catch (error) {
    console.error(`[Blockchain] Error getting tx status:`, error);
    return { confirmed: false };
  }
}
