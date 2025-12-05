/**
 * Debug endpoint to fetch available networks from Mesh API
 * 
 * GET /api/debug/mesh-networks
 * 
 * This endpoint is for debugging purposes to see what networks
 * are actually available in Mesh and get their correct IDs.
 */

import { NextResponse } from "next/server";
import { fetchAvailableMeshNetworks, MESH_NETWORK_IDS, VERIFIED_NETWORKS } from "@/lib/mesh";

export async function GET() {
  try {
    // Fetch available networks from Mesh API
    const result = await fetchAvailableMeshNetworks();
    
    return NextResponse.json({
      success: !result.error,
      message: result.error || "Fetched available networks from Mesh API",
      currentConfig: {
        verifiedNetworks: VERIFIED_NETWORKS,
        networkIds: MESH_NETWORK_IDS,
      },
      meshApiResponse: result.networks,
    });
  } catch (error) {
    console.error("[Debug] Failed to fetch Mesh networks:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        currentConfig: {
          verifiedNetworks: VERIFIED_NETWORKS,
          networkIds: MESH_NETWORK_IDS,
        },
      },
      { status: 500 }
    );
  }
}
