/**
 * ===========================================
 * POST /api/create-order
 * ===========================================
 * 
 * Creates a new order for payment processing.
 * 
 * Request Body:
 * - amount: number (required) - Payment amount in USD
 * - description?: string - Optional order description
 * - items?: OrderItem[] - Optional array of order items
 * - stablecoin?: string - Stablecoin to use (default: USDC)
 * - networkId?: string - Blockchain network (default: Ethereum)
 * 
 * Response:
 * - success: boolean
 * - order?: Order - Created order object
 * - error?: string - Error message if failed
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { createOrder, upsertPaymentStatus } from "@/lib/dynamo";
import { getMerchantWalletAddress } from "@/lib/secrets";
import type {
  Order,
  CreateOrderRequest,
  CreateOrderResponse,
  PaymentStatusRecord,
  StablecoinSymbol,
  NetworkId,
} from "@/lib/types";

// ===========================================
// Request Validation Schema
// ===========================================

const createOrderSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(10000, "Amount cannot exceed $10,000"),
  description: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    )
    .optional(),
  stablecoin: z.enum(["USDC", "USDT", "DAI", "BUSD", "any"]).optional().default("USDC"),
  networkId: z.enum([
    "ethereum",
    "polygon", 
    "arbitrum",
    "optimism",
    "base",
    "avalanche",
    "bsc",
    "auto", // Auto-detect mode
    // Legacy IDs for backward compatibility
    "e3c7fdd8-b1fc-4e51-85ae-bb276e075611",
    "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
  ]).optional().default("base"),
});

// ===========================================
// Configuration
// ===========================================

// Order expiration time (15 minutes)
const ORDER_EXPIRATION_MINUTES = 15;

// Default network (Ethereum)
const DEFAULT_NETWORK_ID =
  process.env.DEFAULT_NETWORK_ID || "e3c7fdd8-b1fc-4e51-85ae-bb276e075611";

// ===========================================
// POST Handler
// ===========================================

export async function POST(request: NextRequest): Promise<NextResponse<CreateOrderResponse>> {
  console.log("[API] POST /api/create-order");

  try {
    // Parse request body
    const body: CreateOrderRequest = await request.json();
    console.log("[API] Request body:", JSON.stringify(body, null, 2));

    // Validate request
    const validationResult = createOrderSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("[API] Validation error:", validationResult.error);
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${validationResult.error.errors.map((e) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { amount, description, items, stablecoin, networkId } = validationResult.data;

    // Get merchant wallet address
    const merchantWalletAddress = await getMerchantWalletAddress();
    if (!merchantWalletAddress) {
      console.error("[API] Merchant wallet address not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Merchant wallet address not configured",
        },
        { status: 500 }
      );
    }

    // Generate order ID
    const orderId = uuidv4();

    // Calculate timestamps
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ORDER_EXPIRATION_MINUTES * 60 * 1000);

    // Create order object
    const order: Order = {
      orderId,
      amount,
      currency: "USD",
      stablecoin: stablecoin as StablecoinSymbol,
      merchantWalletAddress,
      status: "pending",
      description,
      items,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      networkId: (networkId || DEFAULT_NETWORK_ID) as NetworkId,
    };

    console.log("[API] Creating order:", orderId);

    // Store order in DynamoDB
    await createOrder(order);

    // Create initial payment status record
    const paymentStatus: PaymentStatusRecord = {
      orderId,
      status: "pending",
      updatedAt: now.toISOString(),
      statusHistory: [
        {
          status: "pending",
          timestamp: now.toISOString(),
          message: "Order created",
        },
      ],
    };

    await upsertPaymentStatus(paymentStatus);

    console.log("[API] Order created successfully:", orderId);

    return NextResponse.json(
      {
        success: true,
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Error creating order:", error);

    return NextResponse.json(
      {
        success: false,
        error: `Failed to create order: ${(error as Error).message}`,
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
