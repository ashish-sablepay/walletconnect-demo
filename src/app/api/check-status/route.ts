/**
 * ===========================================
 * GET /api/check-status
 * ===========================================
 * 
 * Checks the current status of a payment order.
 * Frontend polls this endpoint to update the UI.
 * 
 * Detection methods:
 * 1. Database status (from webhooks or previous checks)
 * 2. Blockchain monitoring (checks for incoming transfers)
 * 3. Mesh transfer status (if transfer was initiated via Mesh)
 * 
 * Query Parameters:
 * - orderId: string (required) - The order ID to check
 * 
 * Response:
 * - success: boolean
 * - status?: PaymentStatus - Current payment status
 * - paymentDetails?: PaymentStatusRecord - Full payment details
 * - order?: Order - The order object
 * - error?: string - Error message if failed
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrder, getPaymentStatus, updateOrderStatus, updatePaymentStatus } from "@/lib/dynamo";
import { getTransferStatus } from "@/lib/mesh";
import { checkForTransfers, checkAllNetworksForTransfers } from "@/lib/blockchain";
import type { CheckStatusResponse, PaymentStatus } from "@/lib/types";

// ===========================================
// GET Handler
// ===========================================

export async function GET(request: NextRequest): Promise<NextResponse<CheckStatusResponse>> {
  console.log("[API] GET /api/check-status");

  try {
    // Get order ID from query params
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order ID format",
        },
        { status: 400 }
      );
    }

    console.log("[API] Checking status for order:", orderId);

    // Get order and payment status from database
    const [order, paymentDetails] = await Promise.all([
      getOrder(orderId),
      getPaymentStatus(orderId),
    ]);

    if (!order) {
      console.error("[API] Order not found:", orderId);
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    // Check if order has expired
    if (new Date(order.expiresAt) < new Date() && order.status === "pending") {
      console.log("[API] Order expired, updating status:", orderId);
      await updateOrderStatus(orderId, "expired");
      order.status = "expired";
    }

    // If order is still pending or scanning, check blockchain for incoming transfers
    // This detects payments made via WalletConnect QR code
    if (order.status === "pending" || order.status === "scanning") {
      console.log("[API] Checking blockchain for incoming transfers...");
      
      try {
        // Check the preferred network first, then all networks
        const networkId = order.networkId === "auto" ? undefined : order.networkId;
        
        const blockchainResult = networkId
          ? await checkForTransfers(
              order.merchantWalletAddress,
              networkId,
              undefined,
              order.amount
            )
          : await checkAllNetworksForTransfers(
              order.merchantWalletAddress,
              order.amount
            );

        if (blockchainResult.found && blockchainResult.transfer) {
          console.log("[API] Payment detected on blockchain!");
          console.log(`[API] TX: ${blockchainResult.transfer.transactionHash}`);
          console.log(`[API] Amount: ${blockchainResult.transfer.amount} ${blockchainResult.transfer.tokenSymbol}`);
          
          // Update order and payment status
          await Promise.all([
            updateOrderStatus(orderId, "completed"),
            updatePaymentStatus(orderId, {
              status: "completed",
              transactionHash: blockchainResult.transfer.transactionHash,
              networkId: blockchainResult.transfer.networkId,
              stablecoin: blockchainResult.transfer.tokenSymbol,
              amount: parseFloat(blockchainResult.transfer.amount),
            }),
          ]);
          
          order.status = "completed";
          if (paymentDetails) {
            paymentDetails.status = "completed";
            paymentDetails.transactionHash = blockchainResult.transfer.transactionHash;
          }
        }
      } catch (blockchainError) {
        console.warn("[API] Blockchain monitoring error:", blockchainError);
        // Don't fail - continue with other checks
      }
    }

    // If there's an active Mesh transfer, check its status
    if (paymentDetails?.meshTransferId && order.status === "processing") {
      try {
        const transferStatus = await getTransferStatus(paymentDetails.meshTransferId);
        
        // Update status based on transfer result
        let newStatus: PaymentStatus = order.status;
        if (transferStatus.content.status === "completed") {
          newStatus = "completed";
        } else if (transferStatus.content.status === "failed") {
          newStatus = "failed";
        }

        if (newStatus !== order.status) {
          console.log(`[API] Updating order status: ${order.status} -> ${newStatus}`);
          await updateOrderStatus(orderId, newStatus);
          order.status = newStatus;
          
          // Update payment details if completed
          if (newStatus === "completed" && transferStatus.content.transactionHash) {
            paymentDetails.transactionHash = transferStatus.content.transactionHash;
            paymentDetails.status = "completed";
          }
        }
      } catch (error) {
        console.error("[API] Error checking transfer status:", error);
        // Don't fail the request, just return current status
      }
    }

    console.log("[API] Order status:", order.status);

    return NextResponse.json(
      {
        success: true,
        status: order.status,
        paymentDetails: paymentDetails || undefined,
        order,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error checking status:", error);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to check status: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}

// ===========================================
// OPTIONS Handler (CORS)
// ===========================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
