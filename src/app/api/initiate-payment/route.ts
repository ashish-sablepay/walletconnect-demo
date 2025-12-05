/**
 * ===========================================
 * POST /api/initiate-payment
 * ===========================================
 * 
 * Initiates a payment transfer after customer authentication.
 * Called after the customer has authorized via Mesh Link.
 * 
 * Request Body:
 * - orderId: string (required) - The order ID
 * - authToken: string (required) - Auth token from Mesh Link
 * - accountId: string (required) - Account ID to transfer from
 * 
 * Response:
 * - success: boolean
 * - transferId?: string - Mesh transfer ID
 * - preview?: TransferPreview - Transfer preview details
 * - error?: string - Error message if failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrder, updateOrderStatus, updatePaymentStatus } from "@/lib/dynamo";
import { executeTransfer, previewTransfer } from "@/lib/mesh";
import type { InitiatePaymentRequest, InitiatePaymentResponse } from "@/lib/types";

// ===========================================
// Request Validation Schema
// ===========================================

const initiatePaymentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID format"),
  authToken: z.string().min(1, "Auth token is required"),
  accountId: z.string().min(1, "Account ID is required"),
});

// ===========================================
// POST Handler
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse<InitiatePaymentResponse>> {
  console.log("[API] POST /api/initiate-payment");

  try {
    // Parse request body
    const body: InitiatePaymentRequest = await request.json();
    console.log("[API] Request body:", { orderId: body.orderId, accountId: body.accountId });

    // Validate request
    const validationResult = initiatePaymentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { orderId, authToken, accountId } = validationResult.data;

    // Get order from database
    const order = await getOrder(orderId);
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

    // Check if order is expired
    if (new Date(order.expiresAt) < new Date()) {
      console.error("[API] Order expired:", orderId);
      await updateOrderStatus(orderId, "expired");
      return NextResponse.json(
        {
          success: false,
          error: "Order has expired",
        },
        { status: 400 }
      );
    }

    // Check order status
    const validStatuses = ["pending", "scanning", "authorizing"];
    if (!validStatuses.includes(order.status)) {
      console.error("[API] Invalid order status:", order.status);
      return NextResponse.json(
        {
          success: false,
          error: `Cannot initiate payment for order with status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    console.log("[API] Initiating payment for order:", orderId);

    // Update status to processing
    await updateOrderStatus(orderId, "processing");
    await updatePaymentStatus(orderId, {
      status: "processing",
    });

    // Get transfer preview first
    const preview = await previewTransfer({
      fromType: "exchange", // or 'wallet' based on account type
      toAddress: order.merchantWalletAddress,
      symbol: order.stablecoin,
      networkId: order.networkId,
      amount: order.amount.toString(),
      fiatCurrency: "USD",
      fiatAmount: order.amount,
    });

    console.log("[API] Transfer preview:", preview);

    // Execute the transfer
    const transferResult = await executeTransfer({
      fromAuthToken: authToken,
      fromType: "exchange",
      toAddress: order.merchantWalletAddress,
      symbol: order.stablecoin,
      networkId: order.networkId,
      amount: order.amount.toString(),
      fiatCurrency: "USD",
      fiatAmount: order.amount,
    });

    // Update payment status based on result
    if (transferResult.content.status === "completed") {
      await updateOrderStatus(orderId, "completed");
      await updatePaymentStatus(orderId, {
        status: "completed",
        transactionHash: transferResult.content.transactionHash,
        meshTransferId: transferResult.content.transferId,
        senderAddress: transferResult.content.fromAddress,
        amountReceived: transferResult.content.amount,
      });

      console.log("[API] Payment completed for order:", orderId);
    } else if (transferResult.content.status === "pending") {
      await updatePaymentStatus(orderId, {
        status: "processing",
        meshTransferId: transferResult.content.transferId,
      });

      console.log("[API] Payment pending for order:", orderId);
    } else {
      await updateOrderStatus(orderId, "failed");
      await updatePaymentStatus(orderId, {
        status: "failed",
        meshTransferId: transferResult.content.transferId,
        errorMessage: transferResult.message || "Transfer failed",
      });

      console.error("[API] Payment failed for order:", orderId);
    }

    return NextResponse.json(
      {
        success: true,
        transferId: transferResult.content.transferId,
        preview: {
          amount: preview.amount,
          symbol: preview.symbol,
          estimatedFee: preview.fee,
          total: preview.total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error initiating payment:", error);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to initiate payment: ${(error as Error).message}`,
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
