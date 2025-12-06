/**
 * ===========================================
 * In-Memory Storage for Demo
 * ===========================================
 * 
 * Simple in-memory storage for orders and payment status.
 * This is suitable for demo purposes where persistence is not critical.
 * 
 * For production, use Amplify Gen 2 Data API or configure proper
 * IAM permissions for the SSR compute function.
 * 
 * Note: Data is lost when Lambda cold starts. For a real production
 * app, implement proper DynamoDB access with IAM roles.
 */

import type {
  Order,
  PaymentStatus,
  PaymentStatusRecord,
  StatusHistoryEntry,
} from "./types";

// ===========================================
// In-Memory Storage
// ===========================================

/**
 * In-memory store for orders
 * Key: orderId, Value: Order
 */
const ordersStore = new Map<string, Order>();

/**
 * In-memory store for payment status
 * Key: orderId, Value: PaymentStatusRecord
 */
const paymentStatusStore = new Map<string, PaymentStatusRecord>();

// ===========================================
// Order Operations
// ===========================================

/**
 * Create a new order
 * 
 * @param order - The order object to store
 * @returns The created order
 */
export async function createOrder(order: Order): Promise<Order> {
  console.log(`[Storage] Creating order: ${order.orderId}`);
  ordersStore.set(order.orderId, order);
  return order;
}

/**
 * Get an order by ID
 * 
 * @param orderId - The order ID to retrieve
 * @returns The order or null if not found
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  const order = ordersStore.get(orderId);
  if (!order) {
    console.log(`[Storage] Order not found: ${orderId}`);
    return null;
  }
  return order;
}

/**
 * Update an order's status
 * 
 * @param orderId - The order ID to update
 * @param status - The new status
 * @param additionalFields - Optional additional fields to update
 * @returns The updated order
 */
export async function updateOrderStatus(
  orderId: string,
  status: PaymentStatus,
  additionalFields?: Partial<Order>
): Promise<Order> {
  const existing = ordersStore.get(orderId);
  if (!existing) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const updated: Order = {
    ...existing,
    ...additionalFields,
    status,
    updatedAt: new Date().toISOString(),
  };

  ordersStore.set(orderId, updated);
  console.log(`[Storage] Updated order ${orderId} status to: ${status}`);
  return updated;
}

/**
 * Delete an order
 * 
 * @param orderId - The order ID to delete
 */
export async function deleteOrder(orderId: string): Promise<void> {
  ordersStore.delete(orderId);
  console.log(`[Storage] Deleted order: ${orderId}`);
}

// ===========================================
// Payment Status Operations
// ===========================================

/**
 * Create or update a payment status record
 * 
 * @param record - The payment status record
 * @returns The created/updated record
 */
export async function upsertPaymentStatus(
  record: PaymentStatusRecord
): Promise<PaymentStatusRecord> {
  paymentStatusStore.set(record.orderId, record);
  console.log(`[Storage] Upserted payment status for order: ${record.orderId}`);
  return record;
}

/**
 * Get payment status by order ID
 * 
 * @param orderId - The order ID
 * @returns The payment status record or null
 */
export async function getPaymentStatus(
  orderId: string
): Promise<PaymentStatusRecord | null> {
  const status = paymentStatusStore.get(orderId);
  if (!status) {
    console.log(`[Storage] Payment status not found: ${orderId}`);
    return null;
  }
  return status;
}

/**
 * Update payment status with new information
 * 
 * @param orderId - The order ID
 * @param updates - Fields to update
 * @returns The updated record
 */
export async function updatePaymentStatus(
  orderId: string,
  updates: Partial<PaymentStatusRecord>
): Promise<PaymentStatusRecord> {
  const existing = paymentStatusStore.get(orderId);
  
  // Build status history entry if status is being updated
  let statusHistory: StatusHistoryEntry[] = existing?.statusHistory || [];
  if (updates.status && updates.status !== existing?.status) {
    statusHistory = [
      ...statusHistory,
      {
        status: updates.status,
        timestamp: new Date().toISOString(),
        message: updates.errorMessage,
      },
    ];
  }

  const updated: PaymentStatusRecord = {
    orderId,
    status: existing?.status || "pending",
    updatedAt: new Date().toISOString(),
    ...existing,
    ...updates,
    statusHistory,
  };

  paymentStatusStore.set(orderId, updated);
  console.log(`[Storage] Updated payment status for order: ${orderId}`);
  return updated;
}

/**
 * Delete payment status
 * 
 * @param orderId - The order ID
 */
export async function deletePaymentStatus(orderId: string): Promise<void> {
  paymentStatusStore.delete(orderId);
  console.log(`[Storage] Deleted payment status: ${orderId}`);
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Get all orders (for debugging)
 */
export function getAllOrders(): Order[] {
  return Array.from(ordersStore.values());
}

/**
 * Get all payment statuses (for debugging)
 */
export function getAllPaymentStatuses(): PaymentStatusRecord[] {
  return Array.from(paymentStatusStore.values());
}

/**
 * Clear all data (for testing)
 */
export function clearAllData(): void {
  ordersStore.clear();
  paymentStatusStore.clear();
  console.log("[Storage] Cleared all data");
}

/**
 * Get store statistics
 */
export function getStoreStats(): { orders: number; paymentStatuses: number } {
  return {
    orders: ordersStore.size,
    paymentStatuses: paymentStatusStore.size,
  };
}

/**
 * Scan orders by merchant address and optional status filter
 * Used by webhooks to find pending orders for a merchant
 * 
 * @param merchantAddress - The merchant wallet address (case-insensitive)
 * @param statuses - Optional array of statuses to filter by
 * @returns Array of matching orders
 */
export async function scanOrdersByMerchantAddress(
  merchantAddress: string,
  statuses?: PaymentStatus[]
): Promise<Order[]> {
  const normalizedAddress = merchantAddress.toLowerCase();
  
  const allOrders = Array.from(ordersStore.values());
  
  return allOrders.filter(order => {
    // Match merchant address (case-insensitive)
    if (order.merchantWalletAddress.toLowerCase() !== normalizedAddress) {
      return false;
    }
    
    // If statuses filter provided, check status
    if (statuses && statuses.length > 0) {
      return statuses.includes(order.status);
    }
    
    return true;
  });
}
