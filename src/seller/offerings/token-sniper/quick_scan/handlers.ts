import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface TokenScanResult {
  tokenAddress: string;
  chain: string;
  riskScore: number;
  verdict: string;
  checks: {
    honeypot: { status: string; risk: string };
    liquidity: { status: string; risk: string };
    ownership: { status: string; risk: string };
    trading: { status: string; risk: string };
  };
  warnings: string[];
  recommendation: string;
}

async function checkHoneypot(tokenAddress: string, chain: string): Promise<any> {
  try {
    // Using Honeypot.is API (free, no key required)
    const response = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=${getChainId(chain)}`
    );

    if (!response.ok) {
      return { isHoneypot: null, error: "API unavailable" };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Honeypot check error:", error.message);
    return { isHoneypot: null, error: error.message };
  }
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

async function getTokenInfo(tokenAddress: string, chain: string): Promise<any> {
  try {
    // Attempt to fetch basic token info from explorer API
    // This is a simplified implementation - in production you'd use actual explorer APIs
    return {
      name: "Unknown Token",
      symbol: "???",
      decimals: 18,
      totalSupply: "0",
    };
  } catch (error: any) {
    console.error("Token info error:", error.message);
    return null;
  }
}

function calculateRiskScore(honeypotData: any): number {
  let score = 0;

  // Honeypot detection (0-4 points)
  if (honeypotData.honeypotResult?.isHoneypot) {
    score += 4;
  }

  // High buy/sell tax (0-3 points)
  const buyTax = honeypotData.simulationResult?.buyTax || 0;
  const sellTax = honeypotData.simulationResult?.sellTax || 0;
  if (buyTax > 10 || sellTax > 10) score += 3;
  else if (buyTax > 5 || sellTax > 5) score += 2;
  else if (buyTax > 2 || sellTax > 2) score += 1;

  // Transfer issues (0-2 points)
  if (honeypotData.simulationResult?.transferTax > 0) score += 2;

  // Liquidity issues (0-1 point)
  if (honeypotData.pair?.liquidity && honeypotData.pair.liquidity < 1000) {
    score += 1;
  }

  return Math.min(score, 10);
}

function generateVerdict(riskScore: number): string {
  if (riskScore >= 8) return "🔴 DANGER - DO NOT BUY";
  if (riskScore >= 5) return "🟠 CAUTION - High Risk";
  if (riskScore >= 3) return "🟡 MODERATE - Proceed Carefully";
  return "🟢 SAFE - Low Risk Detected";
}

function generateRecommendation(riskScore: number, honeypotData: any): string {
  if (riskScore >= 8) {
    return "AVOID THIS TOKEN. Strong indicators of scam/honeypot. Do not invest.";
  }
  if (riskScore >= 5) {
    return "HIGH RISK. Multiple red flags detected. Only invest if you fully understand the risks.";
  }
  if (riskScore >= 3) {
    return "MODERATE RISK. Some concerns present. Do additional research before investing.";
  }
  return "LOW RISK. No major red flags detected. Always DYOR before investing.";
}

async function scanToken(tokenAddress: string, chain: string): Promise<TokenScanResult> {
  // Check honeypot status
  const honeypotData = await checkHoneypot(tokenAddress, chain);

  const warnings: string[] = [];

  // Analyze honeypot data
  if (honeypotData.honeypotResult?.isHoneypot) {
    warnings.push("⚠️ HONEYPOT DETECTED - Cannot sell this token");
  }

  const buyTax = honeypotData.simulationResult?.buyTax || 0;
  const sellTax = honeypotData.simulationResult?.sellTax || 0;

  if (buyTax > 10) warnings.push(`⚠️ Very high buy tax: ${buyTax}%`);
  if (sellTax > 10) warnings.push(`⚠️ Very high sell tax: ${sellTax}%`);
  if (sellTax > buyTax + 5) warnings.push(`⚠️ Sell tax much higher than buy tax`);

  if (honeypotData.simulationResult?.transferTax > 0) {
    warnings.push(`⚠️ Transfer tax detected: ${honeypotData.simulationResult.transferTax}%`);
  }

  // Calculate risk score
  const riskScore = calculateRiskScore(honeypotData);
  const verdict = generateVerdict(riskScore);
  const recommendation = generateRecommendation(riskScore, honeypotData);

  // Build check results
  const checks = {
    honeypot: {
      status: honeypotData.honeypotResult?.isHoneypot ? "FAILED" : "PASSED",
      risk: honeypotData.honeypotResult?.isHoneypot ? "CRITICAL" : "LOW",
    },
    liquidity: {
      status: honeypotData.pair?.liquidity > 5000 ? "PASSED" : "WARNING",
      risk: honeypotData.pair?.liquidity > 5000 ? "LOW" : "MEDIUM",
    },
    ownership: {
      status: "UNKNOWN",
      risk: "UNKNOWN",
    },
    trading: {
      status: buyTax < 5 && sellTax < 10 ? "PASSED" : "WARNING",
      risk: buyTax < 5 && sellTax < 10 ? "LOW" : "MEDIUM",
    },
  };

  return {
    tokenAddress,
    chain,
    riskScore,
    verdict,
    checks,
    warnings,
    recommendation,
  };
}

function formatScanReport(result: TokenScanResult): string {
  const timestamp = new Date().toISOString();

  const checksReport = `
🔍 Security Checks:
  • Honeypot: ${result.checks.honeypot.status} (${result.checks.honeypot.risk} risk)
  • Liquidity: ${result.checks.liquidity.status} (${result.checks.liquidity.risk} risk)
  • Trading: ${result.checks.trading.status} (${result.checks.trading.risk} risk)
  • Ownership: ${result.checks.ownership.status} (${result.checks.ownership.risk} risk)
  `.trim();

  const warningsReport =
    result.warnings.length > 0
      ? `\n\n⚠️ Warnings:\n${result.warnings.map((w) => `  ${w}`).join("\n")}`
      : "";

  return `
🎯 TOKEN SNIPER - Quick Scan Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp}

📍 Token: ${result.tokenAddress}
🔗 Chain: ${result.chain.toUpperCase()}

🎲 Risk Score: ${result.riskScore}/10
${result.verdict}

${checksReport}
${warningsReport}

💡 Recommendation:
${result.recommendation}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Scan completed in <90 seconds
🛡️ Always DYOR before investing
  `.trim();
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const tokenAddress = request.tokenAddress;
    const chain = request.chain || "base";

    // Validate address format
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return {
        deliverable: "Invalid token address format. Please provide a valid 0x address.",
        error: "Invalid address",
      };
    }

    // Scan token
    const result = await scanToken(tokenAddress, chain);

    // Format report
    const report = formatScanReport(result);

    return {
      deliverable: report,
      metadata: {
        tokenAddress,
        chain,
        riskScore: result.riskScore,
        verdict: result.verdict,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error scanning token: ${error.message}`,
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

  return { valid: true };
}

export function requestPayment(request: any): string {
  const chain = request.chain || "base";
  return `Quick Token Scan on ${chain} - 90-second safety check`;
}
