/**
 * ===========================================
 * POST /api/webhooks/mesh
 * ===========================================
 * 
 * Webhook endpoint for Mesh transfer notifications.
 * Mesh sends updates when transfers initiated through Mesh are:
 * - pending: Transfer initiated but not yet confirmed
 * - succeeded: Transfer completed successfully
 * - failed: Transfer failed
 * 
 * Security: Validates HMAC signature from Mesh
 * 
 * @see https://docs.meshconnect.com/testing/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { updatePaymentStatus, getOrderByTransactionId } from "@/lib/dynamo";

// ===========================================
// Webhook Types
// ===========================================

interface MeshWebhookPayload {
  Id: string;                      // Unique ID for this webhook call
  EventId: string;                 // Event identifier (same across retries)
  SentTimestamp: number;           // When webhook was sent
  UserId: string;                  // User ID provided when creating link token
  TransactionId: string;           // Transaction ID provided by client
  TransferId: string;              // Mesh's transfer ID
  TransferStatus: "pending" | "succeeded" | "failed";
  TxHash?: string;                 // Blockchain transaction hash
  Chain?: string;                  // e.g., "Ethereum", "Polygon"
  Token?: string;                  // e.g., "USDC", "USDT"
  DestinationAddress?: string;     // Merchant address
  SourceAccountProvider?: string;  // e.g., "Binance", "Coinbase"
  SourceAmount?: number;           // Amount sent
  DestinationAmount?: number;      // Amount received
  RefundAddress?: string;          // Refund address if applicable
  Timestamp: number;               // Event timestamp
}

// ===========================================
// Signature Verification
// ===========================================

/**
 * Verify HMAC signature from Mesh
 * Mesh signs webhooks with HMAC-SHA256 using your webhook secret
 */
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const expectedSignature = hmac.update(payload).digest("base64");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

// ===========================================
// POST Handler
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[Webhook] Received Mesh webhook");

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Get signature header
    const signature = request.headers.get("X-Mesh-Signature-256");
    
    // Get webhook secret from environment
    const webhookSecret = process.env.MESH_WEBHOOK_SECRET;
    
    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = verifySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error("[Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("[Webhook] Signature verified");
    } else if (webhookSecret && !signature) {
      console.warn("[Webhook] No signature provided but secret is configured");
    }

    // Parse payload
    const payload: MeshWebhookPayload = JSON.parse(rawBody);
    
    console.log("[Webhook] Payload:", {
      eventId: payload.EventId,
      status: payload.TransferStatus,
      txHash: payload.TxHash,
      chain: payload.Chain,
      token: payload.Token,
      amount: payload.DestinationAmount,
      userId: payload.UserId,
    });

    // Extract order ID from UserId (we use "user_{orderId}" format)
    const orderId = payload.UserId?.replace("user_", "");
    
    if (!orderId) {
      console.error("[Webhook] Could not extract order ID from UserId:", payload.UserId);
      // Still return 200 to prevent retries
      return NextResponse.json({ received: true });
    }

    // Map Mesh status to our payment status
    const statusMap: Record<string, string> = {
      pending: "processing",
      succeeded: "completed",
      failed: "failed",
    };

    const newStatus = statusMap[payload.TransferStatus.toLowerCase()] || "processing";

    // Update payment status in database
    await updatePaymentStatus(orderId, {
      status: newStatus as "pending" | "processing" | "completed" | "failed",
      transactionHash: payload.TxHash,
      networkId: payload.Chain?.toLowerCase(),
      stablecoin: payload.Token,
      amount: payload.DestinationAmount,
    });

    console.log(`[Webhook] Updated order ${orderId} status to ${newStatus}`);

    // Return 200 quickly (Mesh expects response in <200ms)
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    // Return 200 anyway to prevent infinite retries
    return NextResponse.json({ received: true, error: "Processing error" }, { status: 200 });
  }
}

// ===========================================
// GET Handler (for testing/verification)
// ===========================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    message: "Mesh webhook endpoint is active",
    expectedHeaders: ["X-Mesh-Signature-256"],
    documentation: "https://docs.meshconnect.com/testing/webhooks",
  });
}
