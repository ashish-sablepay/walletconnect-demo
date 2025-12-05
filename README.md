# WalletConnect Demo - Merchant POS

<div align="center">

**Accept Stablecoin Payments with WalletConnect Pay + Mesh**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![AWS Amplify](https://img.shields.io/badge/AWS%20Amplify-Gen2-orange?logo=awsamplify)](https://docs.amplify.aws/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black)](https://ui.shadcn.com/)

</div>

---

## 🚀 Overview

A full-stack merchant Point of Sale (POS) demo for accepting stablecoin payments. It leverages:

- **WalletConnect Pay** for universal QR code generation that works with any Web3 wallet
- **Mesh APIs** for customer authentication and secure stablecoin transfers
- **AWS Amplify Gen2** for serverless infrastructure (DynamoDB)

### Supported Networks
- Base (Default - Low fees, fast)
- Polygon
- Arbitrum
- Optimism
- Ethereum
- Avalanche
- BSC

### Supported Stablecoins
- USDC (Default)
- USDT
- DAI
- BUSD

---

## 🔄 Payment Flow

1. **Merchant** enters payment amount in POS terminal
2. **System** creates order and generates WalletConnect QR code
3. **Customer** scans QR with any Web3 wallet
4. **Mesh** handles authentication and executes stablecoin transfer
5. **System** confirms payment and updates order status

---

## 📋 Prerequisites

Before deploying, you'll need:

1. **WalletConnect Project ID**
   - Sign up at [WalletConnect Cloud](https://cloud.walletconnect.com)
   - Create a new project
   - Copy your Project ID

2. **Mesh API Credentials**
   - Sign up at [Mesh Dashboard](https://dashboard.meshconnect.com)
   - Get your Client ID and Client Secret
   - For testing, use the sandbox environment

3. **AWS Account**
   - AWS CLI configured with appropriate permissions
   - Node.js 18+ installed

4. **Merchant Wallet Address**
   - An Ethereum-compatible wallet address to receive payments

---

## 🚀 Deployment to AWS Amplify Gen2

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/walletconnect-demo.git
cd walletconnect-demo
npm install
```

### Step 2: Initialize Amplify

```bash
npx ampx sandbox
```

This will create the DynamoDB tables and output the configuration.

### Step 3: Set Environment Variables

In AWS Amplify Console, add these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `MERCHANT_WALLET_ADDRESS` | Your wallet address to receive payments | ✅ Yes |
| `WALLETCONNECT_PROJECT_ID` | From WalletConnect Cloud | ✅ Yes |
| `MESH_CLIENT_ID` | From Mesh Dashboard | ✅ Yes |
| `MESH_CLIENT_SECRET` | From Mesh Dashboard | ✅ Yes |
| `MESH_API_URL` | `https://sandbox-integration-api.meshconnect.com` (sandbox) or `https://integration-api.meshconnect.com` (production) | ✅ Yes |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) | ✅ Yes |
| `DYNAMODB_ORDERS_TABLE` | Order table name (from Amplify output) | ✅ Yes |
| `DYNAMODB_PAYMENT_STATUS_TABLE` | Payment status table name (from Amplify output) | ✅ Yes |
| `MERCHANT_NAME` | Display name for POS (e.g., "Coffee Shop") | Optional |
| `DEFAULT_NETWORK_ID` | Default network ID | Optional |
| `DEFAULT_STABLECOIN` | Default stablecoin (USDC) | Optional |

### Step 4: Deploy to Amplify

Option A: **Connect GitHub Repository**
1. Go to AWS Amplify Console
2. Click "New App" → "Host Web App"
3. Connect your GitHub repository
4. Amplify will auto-detect Next.js and configure build settings
5. Add environment variables in "Environment variables" section
6. Deploy

Option B: **Manual Deployment**
```bash
npx ampx deploy
```

---

## 🛠️ Local Development

1. Copy environment file:
```bash
cp .env.example .env.local
```

2. Fill in your credentials in `.env.local`

3. Start Amplify sandbox:
```bash
npx ampx sandbox
```

4. In another terminal, start Next.js:
```bash
npm run dev
```

5. Open http://localhost:3000

---

## 📁 Project Structure

```
├── amplify/
│   ├── backend.ts          # Amplify backend definition
│   └── data/
│       └── resource.ts     # DynamoDB schema
├── src/
│   ├── app/
│   │   ├── api/            # Next.js API routes
│   │   │   ├── create-order/
│   │   │   ├── generate-qr/
│   │   │   ├── check-status/
│   │   │   └── initiate-payment/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── pos/            # POS terminal component
│   │   └── ui/             # shadcn/ui components
│   └── lib/
│       ├── dynamo.ts       # DynamoDB operations
│       ├── mesh.ts         # Mesh API client
│       ├── walletconnect.ts # WalletConnect QR generation
│       ├── secrets.ts      # Secrets management
│       └── types.ts        # TypeScript types
├── .env.example
├── package.json
└── README.md
```

---

## 🔑 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MERCHANT_WALLET_ADDRESS` | Wallet to receive payments | `0x1234...abcd` |
| `WALLETCONNECT_PROJECT_ID` | WalletConnect Project ID | `abc123def456` |
| `MESH_CLIENT_ID` | Mesh API Client ID | `844dc8b9-...` |
| `MESH_CLIENT_SECRET` | Mesh API Secret | `sk_sand_...` |
| `MESH_API_URL` | Mesh API endpoint | See below |
| `AWS_REGION` | AWS Region | `us-east-1` |
| `DYNAMODB_ORDERS_TABLE` | Orders table name | `Order-xxx-NONE` |
| `DYNAMODB_PAYMENT_STATUS_TABLE` | Status table name | `PaymentStatus-xxx-NONE` |

### Mesh API URLs

- **Sandbox (Testing)**: `https://sandbox-integration-api.meshconnect.com`
- **Production (Live)**: `https://integration-api.meshconnect.com`

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MERCHANT_NAME` | "SablePay Coffee Shop" | POS display name |
| `DEFAULT_NETWORK_ID` | `7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12` | Default Polygon |
| `DEFAULT_STABLECOIN` | `USDC` | Default stablecoin |

---

## 🧪 Testing

### Sandbox Testing with Mesh

1. Use Mesh sandbox credentials
2. Connect a testnet wallet
3. Use testnet stablecoins

### End-to-End Flow

1. Open POS terminal
2. Enter an amount (e.g., $5.00)
3. Click "Create Order & Generate QR"
4. Scan QR with a Web3 wallet
5. Complete payment through Mesh
6. Verify payment confirmation

---

## 📦 Tech Stack

- **Frontend**: Next.js 15.5, React 19, TypeScript 5.7
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Backend**: AWS Amplify Gen2, DynamoDB
- **Payments**: WalletConnect Pay, Mesh APIs
- **QR Codes**: qrcode library

---

## 🔒 Security Notes

- Never commit `.env.local` or expose API secrets
- Use AWS Secrets Manager for production credentials
- Enable DynamoDB point-in-time recovery
- Use HTTPS in production

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🤝 Support

For issues with:
- **WalletConnect**: [WalletConnect Docs](https://docs.walletconnect.com)
- **Mesh**: [Mesh Documentation](https://docs.meshconnect.com)
- **AWS Amplify**: [Amplify Gen2 Docs](https://docs.amplify.aws)
