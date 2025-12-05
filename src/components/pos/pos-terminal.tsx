"use client";

/**
 * ===========================================
 * POS Terminal Component
 * ===========================================
 * 
 * Main POS interface for merchants to accept payments.
 * Handles the full payment flow:
 * 1. Enter amount
 * 2. Select network and stablecoin
 * 3. Generate QR code
 * 4. Customer scans and pays
 * 5. Show success/failure
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  QrCode,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
  Clock,
  Wallet,
  Globe,
  Coins,
  Zap,
} from "lucide-react";
import type {
  Order,
  PaymentStatus,
  CreateOrderResponse,
  GenerateQRResponse,
  CheckStatusResponse,
} from "@/lib/types";

// ===========================================
// Status Badge Component
// ===========================================

function StatusBadge({ status }: { status: PaymentStatus }) {
  const variants: Record<PaymentStatus, { variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "pending"; label: string }> = {
    pending: { variant: "pending", label: "Awaiting Payment" },
    scanning: { variant: "pending", label: "QR Scanned" },
    authorizing: { variant: "warning", label: "Authorizing" },
    processing: { variant: "warning", label: "Processing" },
    completed: { variant: "success", label: "Completed" },
    failed: { variant: "destructive", label: "Failed" },
    expired: { variant: "secondary", label: "Expired" },
    cancelled: { variant: "secondary", label: "Cancelled" },
  };

  const { variant, label } = variants[status] || variants.pending;

  return (
    <Badge variant={variant} className="text-sm">
      {status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

// ===========================================
// QR Code Display Component
// ===========================================

function QRCodeDisplay({
  qrCodeDataUrl,
  paymentUrl,
  expiresAt,
  onCopy,
  isAutoDetect,
  supportedOptions,
}: {
  qrCodeDataUrl: string;
  paymentUrl: string;
  expiresAt: string;
  onCopy: () => void;
  isAutoDetect?: boolean;
  supportedOptions?: { network: string; stablecoin: string; chainId: number }[] | null;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Get unique networks and stablecoins for summary
  const uniqueNetworks = supportedOptions 
    ? [...new Set(supportedOptions.map(o => o.network))]
    : [];
  const uniqueStablecoins = supportedOptions 
    ? [...new Set(supportedOptions.map(o => o.stablecoin))]
    : [];

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="qr-container">
        <img
          src={qrCodeDataUrl}
          alt="Payment QR Code"
          className="w-64 h-64 rounded-lg"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock className="w-4 h-4" />
        <span>Expires in: {timeLeft}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCopy}>
          <Copy className="w-4 h-4 mr-1" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" />
            Open
          </a>
        </Button>
      </div>

      {isAutoDetect && supportedOptions && supportedOptions.length > 0 ? (
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">Auto-Detect Enabled</span>
          </div>
          <p className="text-sm text-gray-500 max-w-xs">
            Accepts <strong>{uniqueStablecoins.length}</strong> stablecoins across <strong>{uniqueNetworks.length}</strong> networks
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="text-xs text-orange-600 hover:text-orange-700"
          >
            {showAllOptions ? "Hide options" : `View all ${supportedOptions.length} options`}
          </Button>
          {showAllOptions && (
            <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                {supportedOptions.slice(0, 20).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1 text-gray-600">
                    <span className="font-medium">{opt.stablecoin}</span>
                    <span className="text-gray-400">on</span>
                    <span>{opt.network}</span>
                  </div>
                ))}
              </div>
              {supportedOptions.length > 20 && (
                <p className="text-gray-400 mt-1">+{supportedOptions.length - 20} more...</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-center text-gray-500 max-w-xs">
          Scan with any WalletConnect-compatible wallet to pay
        </p>
      )}
    </div>
  );
}

// ===========================================
// Success Display Component
// ===========================================

function SuccessDisplay({
  transactionHash,
  amount,
  onNewPayment,
}: {
  transactionHash?: string;
  amount: number;
  onNewPayment: () => void;
}) {
  const truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="flex flex-col items-center space-y-6 py-8">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-check-bounce">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
      </div>

      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900">Payment Successful!</h3>
        <p className="text-gray-600 mt-1">
          ${amount.toFixed(2)} USDC received
        </p>
      </div>

      {transactionHash && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-gray-500">Transaction Hash</p>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
            <code className="text-sm font-mono text-gray-700">
              {truncateHash(transactionHash)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                navigator.clipboard.writeText(transactionHash);
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              asChild
            >
              <a
                href={`https://etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>
      )}

      <Button onClick={onNewPayment} size="lg" className="mt-4">
        <RefreshCw className="w-4 h-4 mr-2" />
        New Payment
      </Button>
    </div>
  );
}

// ===========================================
// Network and Stablecoin Configuration
// ===========================================

const NETWORKS = [
  { id: "base", name: "Base", icon: "🔷", chainId: 8453, fees: "very low" },
  { id: "polygon", name: "Polygon", icon: "⬡", chainId: 137, fees: "very low" },
  { id: "arbitrum", name: "Arbitrum", icon: "🔵", chainId: 42161, fees: "low" },
  { id: "optimism", name: "Optimism", icon: "🔴", chainId: 10, fees: "low" },
  { id: "avalanche", name: "Avalanche", icon: "🔺", chainId: 43114, fees: "low" },
  { id: "bsc", name: "BNB Chain", icon: "💛", chainId: 56, fees: "very low" },
  { id: "ethereum", name: "Ethereum", icon: "⟠", chainId: 1, fees: "high" },
] as const;

// Comprehensive stablecoin support per network (matching Mesh capabilities)
const STABLECOINS: Record<string, { id: string; name: string; icon: string }[]> = {
  base: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "DAI", name: "DAI", icon: "◈" },
  ],
  polygon: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "DAI", name: "DAI", icon: "◈" },
    { id: "FRAX", name: "FRAX", icon: "🔷" },
    { id: "TUSD", name: "TrueUSD", icon: "🔵" },
    { id: "EURS", name: "EURS", icon: "€" },
  ],
  arbitrum: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "DAI", name: "DAI", icon: "◈" },
    { id: "FRAX", name: "FRAX", icon: "🔷" },
    { id: "LUSD", name: "LUSD", icon: "🟢" },
  ],
  optimism: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "DAI", name: "DAI", icon: "◈" },
    { id: "FRAX", name: "FRAX", icon: "🔷" },
    { id: "LUSD", name: "LUSD", icon: "🟢" },
    { id: "sUSD", name: "sUSD", icon: "🟣" },
  ],
  ethereum: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "DAI", name: "DAI", icon: "◈" },
    { id: "FRAX", name: "FRAX", icon: "🔷" },
    { id: "TUSD", name: "TrueUSD", icon: "🔵" },
    { id: "USDP", name: "USDP", icon: "🅿️" },
    { id: "GUSD", name: "GUSD", icon: "🟩" },
    { id: "LUSD", name: "LUSD", icon: "🟢" },
    { id: "sUSD", name: "sUSD", icon: "🟣" },
    { id: "PYUSD", name: "PayPal USD", icon: "🅿️" },
    { id: "EURS", name: "EURS", icon: "€" },
    { id: "EURT", name: "EURT", icon: "€" },
  ],
  avalanche: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "TUSD", name: "TrueUSD", icon: "🔵" },
  ],
  bsc: [
    { id: "USDC", name: "USDC", icon: "💵" },
    { id: "USDT", name: "Tether", icon: "💲" },
    { id: "BUSD", name: "BUSD", icon: "🟡" },
    { id: "TUSD", name: "TrueUSD", icon: "🔵" },
    { id: "USDD", name: "USDD", icon: "🔶" },
  ],
};

// Smart defaults based on lowest fees and best UX
const DEFAULT_NETWORK = "base"; // Base has very low fees and great UX
const DEFAULT_STABLECOIN = "USDC"; // USDC is the most widely used

// ===========================================
// Main POS Terminal Component
// ===========================================

export function POSTerminal() {
  const { toast } = useToast();
  
  // State
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORK);
  const [selectedStablecoin, setSelectedStablecoin] = useState(DEFAULT_STABLECOIN);
  const [autoDetectMode, setAutoDetectMode] = useState(true); // Auto-detect enabled by default
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [supportedOptions, setSupportedOptions] = useState<{ network: string; stablecoin: string; chainId: number }[] | null>(null);
  const [isAutoDetectQR, setIsAutoDetectQR] = useState(false);

  // Update stablecoin when network changes (ensure valid selection)
  useEffect(() => {
    const availableCoins = STABLECOINS[selectedNetwork] || [];
    if (!availableCoins.find(c => c.id === selectedStablecoin)) {
      setSelectedStablecoin("USDC");
    }
  }, [selectedNetwork, selectedStablecoin]);

  // ===========================================
  // API Handlers
  // ===========================================

  /**
   * Create a new order
   */
  const createOrder = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: description || undefined,
          networkId: autoDetectMode ? "auto" : selectedNetwork,
          stablecoin: autoDetectMode ? "any" : selectedStablecoin,
        }),
      });

      const data: CreateOrderResponse = await response.json();

      if (!data.success || !data.order) {
        throw new Error(data.error || "Failed to create order");
      }

      setCurrentOrder(data.order);
      setStatus("pending");
      
      toast({
        title: "Order Created",
        description: `Order ${data.order.orderId.slice(0, 8)}... created`,
      });

      // Automatically generate QR code
      await generateQR(data.order.orderId);
    } catch (error) {
      console.error("Error creating order:", error);
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Generate QR code for payment
   */
  const generateQR = async (orderId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data: GenerateQRResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate QR code");
      }

      setQrCode(data.qrCodeDataUrl || null);
      setPaymentUrl(data.paymentUrl || null);
      setExpiresAt(data.expiresAt || null);
      setSupportedOptions(data.supportedOptions || null);
      setIsAutoDetectQR(data.isAutoDetect || false);

      // Start polling for status updates
      startPolling(orderId);

      toast({
        title: "QR Code Ready",
        description: data.isAutoDetect 
          ? `Customer can pay with any of ${data.supportedOptions?.length || 'multiple'} options`
          : "Customer can now scan to pay",
      });
    } catch (error) {
      console.error("Error generating QR:", error);
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start polling for payment status
   */
  const startPolling = useCallback((orderId: string) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-status?orderId=${orderId}`);
        const data: CheckStatusResponse = await response.json();

        if (data.success && data.status) {
          setStatus(data.status);

          // Update transaction hash if available
          if (data.paymentDetails?.transactionHash) {
            setTransactionHash(data.paymentDetails.transactionHash);
          }

          // Stop polling on terminal states
          if (["completed", "failed", "expired", "cancelled"].includes(data.status)) {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }

            if (data.status === "completed") {
              toast({
                title: "Payment Received!",
                description: `$${currentOrder?.amount.toFixed(2)} USDC received`,
                variant: "default",
              });
            } else if (data.status === "failed") {
              toast({
                title: "Payment Failed",
                description: data.paymentDetails?.errorMessage || "Payment could not be processed",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking status:", error);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 3 seconds
    const interval = setInterval(checkStatus, 3000);
    setPollingInterval(interval);
  }, [pollingInterval, currentOrder, toast]);

  /**
   * Cancel current payment
   */
  const cancelPayment = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    setCurrentOrder(null);
    setQrCode(null);
    setPaymentUrl(null);
    setExpiresAt(null);
    setStatus("pending");
    setTransactionHash(null);
    setSupportedOptions(null);
    setIsAutoDetectQR(false);
    setShowCancelDialog(false);

    toast({
      title: "Payment Cancelled",
      description: "The payment has been cancelled",
    });
  };

  /**
   * Reset for new payment
   */
  const resetPayment = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    setAmount("");
    setDescription("");
    setCurrentOrder(null);
    setQrCode(null);
    setPaymentUrl(null);
    setExpiresAt(null);
    setStatus("pending");
    setTransactionHash(null);
    setSupportedOptions(null);
    setIsAutoDetectQR(false);
  };

  /**
   * Copy payment URL to clipboard
   */
  const copyPaymentUrl = () => {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl);
      toast({
        title: "Copied!",
        description: "Payment link copied to clipboard",
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // ===========================================
  // Render
  // ===========================================

  return (
    <>
      <Card className="w-full max-w-xl mx-auto shadow-xl border-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
        
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-orange-600" />
              </div>
              <CardTitle className="text-xl">New Payment</CardTitle>
            </div>
            {currentOrder && <StatusBadge status={status} />}
          </div>
          <CardDescription>
            {!currentOrder
              ? "Enter the payment amount to generate a QR code"
              : `Order: ${currentOrder.orderId.slice(0, 8)}...`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Payment Completed State */}
          {status === "completed" && currentOrder && (
            <SuccessDisplay
              transactionHash={transactionHash || undefined}
              amount={currentOrder.amount}
              onNewPayment={resetPayment}
            />
          )}

          {/* Amount Entry State */}
          {!currentOrder && status !== "completed" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 text-2xl font-bold h-14"
                    min="0.01"
                    step="0.01"
                    max="10000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Coffee order #123"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Auto-detect Toggle */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Smart Payment</p>
                    <p className="text-xs text-gray-500">Accept any stablecoin on any network</p>
                  </div>
                </div>
                <Button
                  variant={autoDetectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoDetectMode(!autoDetectMode)}
                  className={autoDetectMode ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  {autoDetectMode ? "ON" : "OFF"}
                </Button>
              </div>

              {/* Network and Stablecoin Selection - Only shown when auto-detect is OFF */}
              {!autoDetectMode && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="network" className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      Network
                    </Label>
                    <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                      <SelectTrigger id="network">
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORKS.map((network) => (
                          <SelectItem key={network.id} value={network.id}>
                            <span className="flex items-center gap-2">
                              <span>{network.icon}</span>
                              <span>{network.name}</span>
                              <span className="text-xs text-gray-400">({network.fees} fees)</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stablecoin" className="flex items-center gap-1">
                      <Coins className="w-4 h-4" />
                      Stablecoin
                    </Label>
                    <Select value={selectedStablecoin} onValueChange={setSelectedStablecoin}>
                      <SelectTrigger id="stablecoin">
                        <SelectValue placeholder="Select coin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(STABLECOINS[selectedNetwork] || []).map((coin) => (
                          <SelectItem key={coin.id} value={coin.id}>
                            <span className="flex items-center gap-2">
                              <span>{coin.icon}</span>
                              <span>{coin.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Show accepted networks when auto-detect is ON */}
              {autoDetectMode && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Accepting payments on:</p>
                  <div className="flex flex-wrap gap-1">
                    {NETWORKS.slice(0, 5).map((network) => (
                      <span key={network.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border">
                        <span>{network.icon}</span>
                        <span>{network.name}</span>
                      </span>
                    ))}
                    <span className="inline-flex items-center px-2 py-1 bg-white rounded-full text-xs border text-gray-400">
                      +{NETWORKS.length - 5} more
                    </span>
                  </div>
                </div>
              )}

              {/* Quick amount buttons */}
              <div className="flex flex-wrap gap-2">
                {[5, 10, 25, 50, 100].map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(value.toString())}
                    className="flex-1"
                  >
                    ${value}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* QR Code Display State */}
          {currentOrder && qrCode && status !== "completed" && (
            <>
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-gray-900">
                  ${currentOrder.amount.toFixed(2)}
                </p>
                {currentOrder.networkId === "auto" ? (
                  <div className="mt-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      <Zap className="w-3 h-3 mr-1" />
                      Any Stablecoin • Any Network
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <span>{STABLECOINS[currentOrder.networkId]?.find(c => c.id === currentOrder.stablecoin)?.icon || "💵"}</span>
                    <span>{currentOrder.stablecoin}</span>
                    <span>on</span>
                    <span>{NETWORKS.find(n => n.id === currentOrder.networkId)?.icon || "🔷"}</span>
                    <span>{NETWORKS.find(n => n.id === currentOrder.networkId)?.name || currentOrder.networkId}</span>
                  </p>
                )}
              </div>

              <Separator />

              {isLoading ? (
                <div className="flex flex-col items-center space-y-4 py-8">
                  <Skeleton className="w-64 h-64 rounded-lg" />
                  <Skeleton className="w-32 h-4" />
                </div>
              ) : (
                <QRCodeDisplay
                  qrCodeDataUrl={qrCode}
                  paymentUrl={paymentUrl || ""}
                  expiresAt={expiresAt || new Date().toISOString()}
                  onCopy={copyPaymentUrl}
                  isAutoDetect={isAutoDetectQR}
                  supportedOptions={supportedOptions}
                />
              )}

              {/* Progress indicator for processing */}
              {status === "processing" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Processing payment...</span>
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  </div>
                  <Progress value={66} className="h-2" />
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 pt-4">
          {!currentOrder && status !== "completed" && (
            <Button
              onClick={createOrder}
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5 mr-2" />
                  Generate Payment QR
                </>
              )}
            </Button>
          )}

          {currentOrder && status !== "completed" && (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              className="w-full"
              disabled={status === "processing"}
            >
              Cancel Payment
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this payment? The QR code will become invalid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Waiting</AlertDialogCancel>
            <AlertDialogAction onClick={cancelPayment}>
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
