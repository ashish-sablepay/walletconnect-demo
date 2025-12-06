/**
 * ===========================================
 * GET /api/debug/check-payment
 * ===========================================
 * 
 * Debug endpoint to manually check for payments on blockchain.
 * Helps troubleshoot payment detection issues.
 * 
 * Query Parameters:
 * - address: Merchant wallet address
 * - network: Network to check (ethereum, polygon, base, etc.)
 * - amount: Expected amount (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkForTransfers, checkAllNetworksForTransfers } from "@/lib/blockchain";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const network = searchParams.get("network");
  const amount = searchParams.get("amount");

  if (!address) {
    return NextResponse.json({
      success: false,
      error: "Missing 'address' parameter",
      usage: "/api/debug/check-payment?address=0x...&network=polygon&amount=5.00",
    });
  }

  console.log(`[Debug] Checking payments for ${address} on ${network || "all networks"}`);

  try {
    const expectedAmount = amount ? parseFloat(amount) : undefined;
    
    let result;
    if (network) {
      result = await checkForTransfers(address, network, undefined, expectedAmount);
    } else {
      result = await checkAllNetworksForTransfers(address, expectedAmount);
    }

    return NextResponse.json({
      success: true,
      query: {
        address,
        network: network || "all",
        expectedAmount,
      },
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      query: { address, network, amount },
    }, { status: 500 });
  }
}
