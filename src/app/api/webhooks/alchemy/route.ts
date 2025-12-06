/**
 * ===========================================
 * POST /api/webhooks/alchemy
 * ===========================================
 * 
 * Webhook endpoint for Alchemy Notify Address Activity.
 * Receives real-time notifications when stablecoins are
 * transferred to the merchant address.
 * 
 * Setup:
 * 1. Go to https://dashboard.alchemy.com/webhooks
 * 2. Create "Address Activity" webhook
 * 3. Add merchant wallet address
 * 4. Set webhook URL to: https://your-app.com/api/webhooks/alchemy
 * 5. Copy signing key to ALCHEMY_WEBHOOK_SIGNING_KEY env var
 * 
 * @see https://docs.alchemy.com/reference/address-activity-webhook
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { updatePaymentStatus, updateOrderStatus, scanOrdersByMerchantAddress } from "@/lib/dynamo";

// ===========================================
// Alchemy Webhook Types
// ===========================================

interface AlchemyActivity {
  blockNum: string;
  hash: string;
  fromAddress: string;
  toAddress: string;
  value: number;
  asset: string;  // "USDC", "USDT", "ETH", etc.
  category: "external" | "internal" | "token" | "erc20" | "erc721" | "erc1155";
  rawContract: {
    rawValue: string;
    address: string;
    decimals: number;
  };
  log?: {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  };
}

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: "ADDRESS_ACTIVITY";
  event: {
    network: string;  // "ETH_MAINNET", "MATIC_MAINNET", "BASE_MAINNET", etc.
    activity: AlchemyActivity[];
  };
}

// Network mapping from Alchemy format to our format
const ALCHEMY_NETWORK_MAP: Record<string, string> = {
  "ETH_MAINNET": "ethereum",
  "ETH_SEPOLIA": "ethereum",
  "MATIC_MAINNET": "polygon",
  "MATIC_AMOY": "polygon",
  "ARB_MAINNET": "arbitrum",
  "ARB_SEPOLIA": "arbitrum",
  "OPT_MAINNET": "optimism",
  "OPT_SEPOLIA": "optimism",
  "BASE_MAINNET": "base",
  "BASE_SEPOLIA": "base",
  "AVAX_MAINNET": "avalanche",
  "BNB_MAINNET": "bsc",
};

// Stablecoins we care about
const STABLECOINS = ["USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "PYUSD"];

// ===========================================
// Signature Verification
// ===========================================

/**
 * Verify HMAC signature from Alchemy
 * Alchemy uses HMAC SHA256 with hex encoding
 */
function verifyAlchemySignature(
  body: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", signingKey);
    hmac.update(body, "utf8");
    const expectedSignature = hmac.digest("hex");
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("[Alchemy Webhook] Signature verification error:", error);
    return false;
  }
}

// ===========================================
// POST Handler
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[Alchemy Webhook] Received webhook");

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Get signature header
    const signature = request.headers.get("X-Alchemy-Signature");
    
    // Get signing key from environment
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
    
    // Verify signature if key is configured
    if (signingKey) {
      if (!signature) {
        console.error("[Alchemy Webhook] Missing signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      
      const isValid = verifyAlchemySignature(rawBody, signature, signingKey);
      if (!isValid) {
        console.error("[Alchemy Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      console.log("[Alchemy Webhook] Signature verified ✓");
    } else {
      console.warn("[Alchemy Webhook] No signing key configured - skipping verification");
    }

    // Parse payload
    const payload: AlchemyWebhookPayload = JSON.parse(rawBody);
    
    console.log("[Alchemy Webhook] Event:", {
      id: payload.id,
      type: payload.type,
      network: payload.event.network,
      activityCount: payload.event.activity.length,
    });

    // Process each activity
    for (const activity of payload.event.activity) {
      await processActivity(activity, payload.event.network);
    }

    // Return 200 quickly
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Alchemy Webhook] Error:", error);
    // Return 200 to prevent retries for parse errors
    return NextResponse.json({ received: true, error: "Processing error" }, { status: 200 });
  }
}

/**
 * Process a single activity from Alchemy
 */
async function processActivity(activity: AlchemyActivity, alchemyNetwork: string): Promise<void> {
  console.log("[Alchemy Webhook] Processing activity:", {
    hash: activity.hash,
    from: activity.fromAddress,
    to: activity.toAddress,
    value: activity.value,
    asset: activity.asset,
    category: activity.category,
  });

  // Only process token transfers (stablecoins)
  if (activity.category !== "token" && activity.category !== "erc20") {
    console.log("[Alchemy Webhook] Skipping non-token transfer");
    return;
  }

  // Only process stablecoin transfers
  if (!STABLECOINS.includes(activity.asset)) {
    console.log(`[Alchemy Webhook] Skipping non-stablecoin: ${activity.asset}`);
    return;
  }

  const merchantAddress = activity.toAddress.toLowerCase();
  const amount = activity.value;
  const txHash = activity.hash;
  const networkId = ALCHEMY_NETWORK_MAP[alchemyNetwork] || alchemyNetwork.toLowerCase();

  console.log(`[Alchemy Webhook] 💰 Stablecoin received!`);
  console.log(`[Alchemy Webhook]   Amount: ${amount} ${activity.asset}`);
  console.log(`[Alchemy Webhook]   To: ${merchantAddress}`);
  console.log(`[Alchemy Webhook]   Network: ${networkId}`);
  console.log(`[Alchemy Webhook]   TX: ${txHash}`);

  // Find pending orders for this merchant address
  try {
    const pendingOrders = await scanOrdersByMerchantAddress(merchantAddress, ["pending", "scanning"]);
    
    if (!pendingOrders || pendingOrders.length === 0) {
      console.log("[Alchemy Webhook] No pending orders found for this address");
      return;
    }

    console.log(`[Alchemy Webhook] Found ${pendingOrders.length} pending orders`);

    // Find matching order by amount (with 5% tolerance)
    const tolerance = 0.05;
    const matchingOrder = pendingOrders.find(order => {
      const diff = Math.abs(order.amount - amount);
      const percentDiff = diff / order.amount;
      return percentDiff <= tolerance;
    });

    if (!matchingOrder) {
      console.log(`[Alchemy Webhook] No order matches amount ${amount}`);
      // Still might want to mark the first pending order as completed
      // if amounts are close enough or for demo purposes
      return;
    }

    console.log(`[Alchemy Webhook] ✓ Matched order: ${matchingOrder.orderId}`);

    // Update order status to completed
    await Promise.all([
      updateOrderStatus(matchingOrder.orderId, "completed"),
      updatePaymentStatus(matchingOrder.orderId, {
        status: "completed",
        transactionHash: txHash,
        networkId: networkId,
        stablecoin: activity.asset,
        amount: amount,
        senderAddress: activity.fromAddress,
      }),
    ]);

    console.log(`[Alchemy Webhook] ✓ Order ${matchingOrder.orderId} marked as COMPLETED`);
  } catch (dbError) {
    console.error("[Alchemy Webhook] Database error:", dbError);
  }
}

// ===========================================
// GET Handler (for testing/verification)
// ===========================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    message: "Alchemy webhook endpoint is active",
    expectedHeaders: ["X-Alchemy-Signature"],
    supportedNetworks: Object.keys(ALCHEMY_NETWORK_MAP),
    supportedStablecoins: STABLECOINS,
    documentation: "https://docs.alchemy.com/reference/address-activity-webhook",
    setup: {
      step1: "Go to https://dashboard.alchemy.com/webhooks",
      step2: "Create 'Address Activity' webhook",
      step3: "Add your merchant wallet address",
      step4: "Set webhook URL to this endpoint",
      step5: "Copy signing key to ALCHEMY_WEBHOOK_SIGNING_KEY env var",
    },
  });
}
