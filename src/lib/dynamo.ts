/**
 * ===========================================
 * DynamoDB Client Library
 * ===========================================
 * 
 * Provides helper functions for interacting with DynamoDB.
 * Handles orders and payment status records.
 * 
 * Uses AWS Amplify Gen2 DynamoDB tables for production.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  Order,
  PaymentStatus,
  PaymentStatusRecord,
  StatusHistoryEntry,
} from "./types";

// ===========================================
// DynamoDB Client Initialization
// ===========================================

/**
 * Initialize DynamoDB client with region from environment
 */
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

/**
 * Document client for easier JSON handling
 */
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
});

// ===========================================
// Table Names (from Amplify Gen2)
// ===========================================

const ORDERS_TABLE = process.env.DYNAMODB_ORDERS_TABLE || "Order-sablepay";
const PAYMENT_STATUS_TABLE = process.env.DYNAMODB_PAYMENT_STATUS_TABLE || "PaymentStatus-sablepay";

// ===========================================
// Order Operations
// ===========================================

/**
 * Create a new order in DynamoDB
 * 
 * @param order - The order object to store
 * @returns The created order
 * @throws Error if the operation fails
 */
export async function createOrder(order: Order): Promise<Order> {
  const command = new PutCommand({
    TableName: ORDERS_TABLE,
    Item: {
      ...order,
      // Add TTL for automatic expiration (24 hours after expiry)
      ttl: Math.floor(new Date(order.expiresAt).getTime() / 1000) + 86400,
    },
    // Prevent overwriting existing orders
    ConditionExpression: "attribute_not_exists(orderId)",
  });

  try {
    await docClient.send(command);
    console.log(`[DynamoDB] Created order: ${order.orderId}`);
    return order;
  } catch (error) {
    console.error(`[DynamoDB] Failed to create order:`, error);
    throw new Error(`Failed to create order: ${(error as Error).message}`);
  }
}

/**
 * Get an order by ID
 * 
 * @param orderId - The order ID to retrieve
 * @returns The order or null if not found
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  const command = new GetCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
  });

  try {
    const response = await docClient.send(command);
    return (response.Item as Order) || null;
  } catch (error) {
    console.error(`[DynamoDB] Failed to get order ${orderId}:`, error);
    throw new Error(`Failed to get order: ${(error as Error).message}`);
  }
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
  const updateExpressionParts = ["#status = :status", "updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = { "#status": "status" };
  const expressionAttributeValues: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": new Date().toISOString(),
  };

  // Add any additional fields to the update
  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value], index) => {
      if (key !== "orderId" && key !== "status" && key !== "updatedAt") {
        const attrName = `#field${index}`;
        const attrValue = `:value${index}`;
        updateExpressionParts.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    });
  }

  const command = new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  try {
    const response = await docClient.send(command);
    console.log(`[DynamoDB] Updated order ${orderId} status to: ${status}`);
    return response.Attributes as Order;
  } catch (error) {
    console.error(`[DynamoDB] Failed to update order ${orderId}:`, error);
    throw new Error(`Failed to update order: ${(error as Error).message}`);
  }
}

/**
 * Delete an order (for cleanup/testing)
 * 
 * @param orderId - The order ID to delete
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const command = new DeleteCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
  });

  try {
    await docClient.send(command);
    console.log(`[DynamoDB] Deleted order: ${orderId}`);
  } catch (error) {
    console.error(`[DynamoDB] Failed to delete order ${orderId}:`, error);
    throw new Error(`Failed to delete order: ${(error as Error).message}`);
  }
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
  const command = new PutCommand({
    TableName: PAYMENT_STATUS_TABLE,
    Item: {
      ...record,
      // Add TTL (7 days)
      ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
  });

  try {
    await docClient.send(command);
    console.log(`[DynamoDB] Upserted payment status for order: ${record.orderId}`);
    return record;
  } catch (error) {
    console.error(`[DynamoDB] Failed to upsert payment status:`, error);
    throw new Error(`Failed to upsert payment status: ${(error as Error).message}`);
  }
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
  const command = new GetCommand({
    TableName: PAYMENT_STATUS_TABLE,
    Key: { orderId },
  });

  try {
    const response = await docClient.send(command);
    return (response.Item as PaymentStatusRecord) || null;
  } catch (error) {
    console.error(`[DynamoDB] Failed to get payment status ${orderId}:`, error);
    throw new Error(`Failed to get payment status: ${(error as Error).message}`);
  }
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
  // First, get the existing record to append to status history
  const existing = await getPaymentStatus(orderId);
  
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

  const updateExpressionParts: string[] = ["updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };

  // Add status history
  updateExpressionParts.push("statusHistory = :statusHistory");
  expressionAttributeValues[":statusHistory"] = statusHistory;

  // Add other update fields
  Object.entries(updates).forEach(([key, value], index) => {
    if (key !== "orderId" && key !== "updatedAt" && key !== "statusHistory" && value !== undefined) {
      if (key === "status") {
        updateExpressionParts.push("#status = :status");
        expressionAttributeNames["#status"] = "status";
        expressionAttributeValues[":status"] = value;
      } else {
        const attrName = `#field${index}`;
        const attrValue = `:value${index}`;
        updateExpressionParts.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    }
  });

  const command = new UpdateCommand({
    TableName: PAYMENT_STATUS_TABLE,
    Key: { orderId },
    UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  try {
    const response = await docClient.send(command);
    console.log(`[DynamoDB] Updated payment status for order: ${orderId}`);
    return response.Attributes as PaymentStatusRecord;
  } catch (error) {
    console.error(`[DynamoDB] Failed to update payment status ${orderId}:`, error);
    throw new Error(`Failed to update payment status: ${(error as Error).message}`);
  }
}

/**
 * Delete payment status (for cleanup/testing)
 * 
 * @param orderId - The order ID
 */
export async function deletePaymentStatus(orderId: string): Promise<void> {
  const command = new DeleteCommand({
    TableName: PAYMENT_STATUS_TABLE,
    Key: { orderId },
  });

  try {
    await docClient.send(command);
    console.log(`[DynamoDB] Deleted payment status: ${orderId}`);
  } catch (error) {
    console.error(`[DynamoDB] Failed to delete payment status ${orderId}:`, error);
    throw new Error(`Failed to delete payment status: ${(error as Error).message}`);
  }
}
