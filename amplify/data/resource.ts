import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * SablePay Data Schema
 * 
 * Defines DynamoDB tables for:
 * - Orders: Store order information from merchant POS
 * - PaymentStatus: Track payment progress through the flow
 */
const schema = a.schema({
  // Orders table - stores merchant orders
  Order: a
    .model({
      orderId: a.id().required(),
      amount: a.float().required(),
      currency: a.string().default('USD'),
      stablecoin: a.string().default('USDC'),
      networkId: a.string().required(),
      merchantWalletAddress: a.string().required(),
      status: a.enum(['pending', 'scanning', 'processing', 'completed', 'failed', 'expired']),
      description: a.string(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      expiresAt: a.datetime().required(),
      transactionHash: a.string(),
      meshTransferId: a.string(),
      ttl: a.integer(),
    })
    .identifier(['orderId'])
    .authorization((allow) => [
      allow.publicApiKey().to(['create', 'read', 'update', 'delete']),
    ]),

  // Payment Status table - tracks payment flow progress
  PaymentStatus: a
    .model({
      orderId: a.id().required(),
      status: a.enum(['pending', 'scanning', 'processing', 'completed', 'failed', 'expired']),
      updatedAt: a.datetime().required(),
      statusHistory: a.json(),
      transactionHash: a.string(),
      blockNumber: a.integer(),
      senderAddress: a.string(),
      amountReceived: a.string(),
      errorMessage: a.string(),
      errorCode: a.string(),
      meshTransferId: a.string(),
      walletConnectSessionId: a.string(),
      ttl: a.integer(),
    })
    .identifier(['orderId'])
    .authorization((allow) => [
      allow.publicApiKey().to(['create', 'read', 'update', 'delete']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
