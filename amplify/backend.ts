import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';

/**
 * SablePay Merchant POS - AWS Amplify Gen2 Backend
 * 
 * This backend provides:
 * - DynamoDB tables for orders and payment status
 * - API Key authentication for public access
 * 
 * The Next.js API routes handle business logic using:
 * - WalletConnect for QR code generation
 * - Mesh for payment transfers
 */
export const backend = defineBackend({
  data,
});

// Configure DynamoDB tables with on-demand capacity
const { cfnResources } = backend.data.resources;

Object.values(cfnResources.amplifyDynamoDbTables).forEach((table: any) => {
  table.billingMode = 'PAY_PER_REQUEST';
  table.pointInTimeRecoveryEnabled = true;
});
