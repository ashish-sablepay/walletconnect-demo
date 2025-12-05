/**
 * ===========================================
 * POST /api/generate-qr
 * ===========================================
 * 
 * Generates a payment QR code for an existing order.
 * 
 * Architecture:
 * - Frontend QR: WalletConnect Pay (beautiful, universal wallet support)
 * - Backend tracking: Blockchain monitoring + Mesh webhooks (optional)
 * 
 * The customer scans the WalletConnect QR, pays directly from their wallet,
 * and the backend detects the incoming transfer via blockchain monitoring.
 * 
 * Request Body:
 * - orderId: string (required) - The order ID to generate QR for
 * 
 * Response:
 * - success: boolean
 * - qrCodeDataUrl?: string - Base64 encoded QR image (WalletConnect)
 * - paymentUrl?: string - Universal deep link URL
 * - expiresAt?: string - QR expiration time
 * - error?: string - Error message if failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrder, updateOrderStatus, updatePaymentStatus } from "@/lib/dynamo";
import { generatePaymentQR } from "@/lib/walletconnect";
import type { GenerateQRRequest, GenerateQRResponse } from "@/lib/types";

// ===========================================
// Request Validation Schema
// ===========================================

const generateQRSchema = z.object({
  orderId: z.string().uuid("Invalid order ID format"),
});

// ===========================================
// POST Handler
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse<GenerateQRResponse>> {
  console.log("[API] POST /api/generate-qr");

  try {
    // Parse request body
    const body: GenerateQRRequest = await request.json();
    console.log("[API] Request body:", JSON.stringify(body, null, 2));

    // Validate request
    const validationResult = generateQRSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { orderId } = validationResult.data;

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

    // Check order status - only pending orders can generate QR
    if (order.status !== "pending" && order.status !== "scanning") {
      console.error("[API] Invalid order status for QR generation:", order.status);
      return NextResponse.json(
        {
          success: false,
          error: `Cannot generate QR for order with status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    console.log("[API] Generating payment QR for order:", orderId);

    // Generate WalletConnect Pay QR code
    // This creates a beautiful, universal QR that works with any Web3 wallet
    const qrResult = await generatePaymentQR(order, order.merchantWalletAddress);

    // Update payment status to pending
    await updatePaymentStatus(orderId, {
      status: "pending",
    });

    console.log("[API] WalletConnect QR code generated successfully for order:", orderId);
    console.log("[API] Payment will be detected via blockchain monitoring");
    if (qrResult.isAutoDetect) {
      console.log(`[API] Auto-detect mode: ${qrResult.supportedOptions?.length || 0} payment options available`);
    }

    return NextResponse.json(
      {
        success: true,
        qrCodeDataUrl: qrResult.qrCodeDataUrl,
        paymentUrl: qrResult.paymentUrl,
        expiresAt: qrResult.expiresAt,
        isAutoDetect: qrResult.isAutoDetect,
        supportedOptions: qrResult.supportedOptions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] Error generating QR:", error);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to generate QR: ${(error as Error).message}`,
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
