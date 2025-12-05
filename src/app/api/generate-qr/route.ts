/**
 * ===========================================
 * POST /api/generate-qr
 * ===========================================
 * 
 * Generates a payment QR code for an existing order.
 * Uses WalletConnect Pay for universal wallet support
 * and Mesh for authentication/transfer.
 * 
 * Request Body:
 * - orderId: string (required) - The order ID to generate QR for
 * 
 * Response:
 * - success: boolean
 * - qrCodeDataUrl?: string - Base64 encoded QR image
 * - paymentUrl?: string - Universal deep link URL
 * - linkToken?: string - Mesh Link token for auth
 * - expiresAt?: string - QR expiration time
 * - error?: string - Error message if failed
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrder, updateOrderStatus, updatePaymentStatus } from "@/lib/dynamo";
import { generatePaymentQR } from "@/lib/walletconnect";
import { generateLinkToken, decodeLinkToken } from "@/lib/mesh";
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
    const qrResult = await generatePaymentQR(order, order.merchantWalletAddress);

    let linkToken: string | undefined;
    let meshLinkUrl: string | undefined;

    // Generate Mesh Link token for authentication
    // This allows customers to authenticate their wallet/exchange and execute transfers
    try {
      const linkTokenResponse = await generateLinkToken(
        `user_${orderId}`, // Use order ID as user identifier
        order.merchantWalletAddress,
        order.amount,
        order.stablecoin,
        order.networkId
      );

      // Decode the link token to get the actual URL
      meshLinkUrl = decodeLinkToken(linkTokenResponse.content.linkToken);
      linkToken = linkTokenResponse.content.linkToken;
      console.log("[API] Mesh Link token generated successfully");
    } catch (meshError) {
      console.error("[API] Mesh API error:", (meshError as Error).message);
      // For production, we need Mesh to work for real transfers
      return NextResponse.json(
        {
          success: false,
          error: `Mesh API error: ${(meshError as Error).message}. Please check your Mesh API credentials.`,
        },
        { status: 500 }
      );
    }

    // Update payment status
    await updatePaymentStatus(orderId, {
      status: "pending",
    });

    console.log("[API] QR code generated successfully for order:", orderId);
    if (qrResult.isAutoDetect) {
      console.log(`[API] Auto-detect mode: ${qrResult.supportedOptions?.length || 0} payment options available`);
    }

    return NextResponse.json(
      {
        success: true,
        qrCodeDataUrl: qrResult.qrCodeDataUrl,
        paymentUrl: qrResult.paymentUrl,
        linkToken,
        meshLinkUrl,
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
