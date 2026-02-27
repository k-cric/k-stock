import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  timestamp: number;
  type: "buy" | "sell" | "transfer";
}

interface WhaleWallet {
  address: string;
  balance: string;
  balanceUSD: number;
  txCount: number;
  firstSeen: number;
  isWhale: boolean;
  label?: string;
}

interface WhaleAnalysis {
  tokenAddress: string;
  chain: string;
  timeframe: string;
  whaleTransactions: WhaleTransaction[];
  topHolders: WhaleWallet[];
  summary: {
    totalWhaleVolume: number;
    buyPressure: number;
    sellPressure: number;
    netFlow: number;
    whaleCount: number;
    accumulation: boolean;
  };
  alerts: string[];
  recommendation: string;
}

function getChainId(chain: string): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    bsc: 56,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
  };
  return chainIds[chain] || 8453;
}

function getTimeframeHours(timeframe: string): number {
  const timeframes: Record<string, number> = {
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };
  return timeframes[timeframe] || 24;
}

async function fetchWhaleData(
  tokenAddress: string,
  chain: string,
  timeframe: string
): Promise<WhaleAnalysis> {
  // In production, this would call actual blockchain APIs like:
  // - Etherscan API
  // - DexScreener API
  // - Covalent API
  // - The Graph

  const now = Date.now();
  const hours = getTimeframeHours(timeframe);

  // Mock data for demonstration
  // In production, replace with actual API calls
  const mockWhaleTransactions: WhaleTransaction[] = [
    {
      hash: "0xabc123...",
      from: "0x1234567890123456789012345678901234567890",
      to: tokenAddress,
      value: "50000",
      valueUSD: 50000,
      timestamp: now - 3600000,
      type: "buy",
    },
    {
      hash: "0xdef456...",
      from: tokenAddress,
      to: "0x9876543210987654321098765432109876543210",
      value: "30000",
      valueUSD: 30000,
      timestamp: now - 7200000,
      type: "sell",
    },
  ];

  const mockTopHolders: WhaleWallet[] = [
    {
      address: "0x1234567890123456789012345678901234567890",
      balance: "1000000",
      balanceUSD: 1000000,
      txCount: 50,
      firstSeen: now - 86400000 * 30,
      isWhale: true,
      label: "Whale #1",
    },
    {
      address: "0x2345678901234567890123456789012345678901",
      balance: "750000",
      balanceUSD: 750000,
      txCount: 35,
      firstSeen: now - 86400000 * 15,
      isWhale: true,
      label: "Whale #2",
    },
  ];

  // Calculate summary
  const buyVolume = mockWhaleTransactions
    .filter((tx) => tx.type === "buy")
    .reduce((sum, tx) => sum + tx.valueUSD, 0);

  const sellVolume = mockWhaleTransactions
    .filter((tx) => tx.type === "sell")
    .reduce((sum, tx) => sum + tx.valueUSD, 0);

  const netFlow = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;
  const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
  const sellPressure = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0;

  const alerts: string[] = [];

  if (netFlow > 100000) {
    alerts.push("🟢 Strong whale accumulation detected");
  } else if (netFlow < -100000) {
    alerts.push("🔴 Heavy whale distribution in progress");
  }

  if (buyPressure > 70) {
    alerts.push("📈 Whales are buying aggressively");
  } else if (sellPressure > 70) {
    alerts.push("📉 Whales are selling aggressively");
  }

  const recommendation =
    netFlow > 50000
      ? "Whales are accumulating. Consider following smart money."
      : netFlow < -50000
        ? "Whales are distributing. Exercise caution."
        : "Whale activity is neutral. Wait for clearer signals.";

  return {
    tokenAddress,
    chain,
    timeframe,
    whaleTransactions: mockWhaleTransactions,
    topHolders: mockTopHolders,
    summary: {
      totalWhaleVolume: totalVolume,
      buyPressure,
      sellPressure,
      netFlow,
      whaleCount: mockTopHolders.length,
      accumulation: netFlow > 0,
    },
    alerts,
    recommendation,
  };
}

function formatWhaleReport(analysis: WhaleAnalysis): string {
  const timestamp = new Date().toISOString();

  const summarySection = `
📊 Whale Activity Summary:
  • Total Whale Volume: $${analysis.summary.totalWhaleVolume.toLocaleString()}
  • Buy Pressure: ${analysis.summary.buyPressure.toFixed(1)}%
  • Sell Pressure: ${analysis.summary.sellPressure.toFixed(1)}%
  • Net Flow: ${analysis.summary.netFlow >= 0 ? "+" : ""}$${analysis.summary.netFlow.toLocaleString()}
  • Active Whales: ${analysis.summary.whaleCount}
  • Pattern: ${analysis.summary.accumulation ? "🟢 ACCUMULATION" : "🔴 DISTRIBUTION"}
  `.trim();

  const alertsSection =
    analysis.alerts.length > 0
      ? `\n\n🚨 Alerts:\n${analysis.alerts.map((a) => `  ${a}`).join("\n")}`
      : "";

  const topHoldersSection = `\n\n🐋 Top Whale Holders:
${analysis.topHolders
  .slice(0, 3)
  .map(
    (h, i) =>
      `  ${i + 1}. ${h.address.slice(0, 10)}...${h.address.slice(-8)}\n     Balance: $${h.balanceUSD.toLocaleString()} | Txs: ${h.txCount}`
  )
  .join("\n")}`;

  const recentTxsSection = `\n\n📝 Recent Whale Transactions:
${analysis.whaleTransactions
  .slice(0, 5)
  .map((tx) => {
    const type = tx.type === "buy" ? "🟢 BUY" : tx.type === "sell" ? "🔴 SELL" : "↔️ TRANSFER";
    const timeAgo = Math.floor((Date.now() - tx.timestamp) / 3600000);
    return `  ${type} $${tx.valueUSD.toLocaleString()} (${timeAgo}h ago)`;
  })
  .join("\n")}`;

  return `
🐋 WHALE WATCH - Smart Money Tracker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp}

📍 Token: ${analysis.tokenAddress}
🔗 Chain: ${analysis.chain.toUpperCase()}
⏱️ Timeframe: ${analysis.timeframe}

${summarySection}
${alertsSection}
${topHoldersSection}
${recentTxsSection}

💡 Recommendation:
${analysis.recommendation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Follow the whales, find the alpha
⚠️ Not financial advice - DYOR
  `.trim();
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const tokenAddress = request.tokenAddress;
    const chain = request.chain || "base";
    const timeframe = request.timeframe || "24h";

    // Validate address format
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return {
        deliverable: "Invalid token address format. Please provide a valid 0x address.",
        error: "Invalid address",
      };
    }

    // Analyze whale activity
    const analysis = await fetchWhaleData(tokenAddress, chain, timeframe);

    // Format report
    const report = formatWhaleReport(analysis);

    return {
      deliverable: report,
      metadata: {
        tokenAddress,
        chain,
        timeframe,
        netFlow: analysis.summary.netFlow,
        accumulation: analysis.summary.accumulation,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error analyzing whale activity: ${error.message}`,
      error: error.message,
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (!request.tokenAddress) {
    return {
      valid: false,
      reason: "Token address is required",
    };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(request.tokenAddress)) {
    return {
      valid: false,
      reason: "Invalid token address format. Must be 0x followed by 40 hex characters.",
    };
  }

  const validChains = ["ethereum", "bsc", "base", "arbitrum", "polygon"];
  if (request.chain && !validChains.includes(request.chain)) {
    return {
      valid: false,
      reason: `Invalid chain. Must be one of: ${validChains.join(", ")}`,
    };
  }

  const validTimeframes = ["24h", "7d", "30d"];
  if (request.timeframe && !validTimeframes.includes(request.timeframe)) {
    return {
      valid: false,
      reason: `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}`,
    };
  }

  return { valid: true };
}

export function requestPayment(request: any): string {
  const chain = request.chain || "base";
  const timeframe = request.timeframe || "24h";
  return `Whale Watch on ${chain} (${timeframe}) - Smart money tracker`;
}
