import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface EtfPair {
  name: string;
  koreanEtf: string;
  koreanCode: string;
  usEtf: string;
}

interface EtfData {
  pair: EtfPair;
  koreanPrice: number;
  usPrice: number;
  usdKrw: number;
  usEtfKrw: number;
  premiumPercent: number;
  recommendation: string;
}

const ETF_PAIRS: Record<string, EtfPair> = {
  SPY: {
    name: "S&P 500",
    koreanEtf: "TIGER 미국S&P500",
    koreanCode: "360750.KS",
    usEtf: "SPY",
  },
  QQQ: {
    name: "Nasdaq 100",
    koreanEtf: "KODEX 미국나스닥100",
    koreanCode: "133690.KS",
    usEtf: "QQQ",
  },
};

async function fetchUsdKrw(): Promise<number> {
  try {
    const response = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d"
    );
    const data = await response.json();
    const quote = data.chart.result[0].meta;
    return quote.regularMarketPrice;
  } catch (error: any) {
    throw new Error(`Failed to fetch USD/KRW: ${error.message}`);
  }
}

async function fetchEtfPrice(symbol: string): Promise<number> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    );
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error(`No data for ${symbol}`);
    }

    const quote = data.chart.result[0].meta;
    return quote.regularMarketPrice;
  } catch (error: any) {
    throw new Error(`Failed to fetch ${symbol}: ${error.message}`);
  }
}

async function analyzeEtfPair(pair: EtfPair, usdKrw: number): Promise<EtfData> {
  // Fetch prices in parallel
  const [koreanPrice, usPrice] = await Promise.all([
    fetchEtfPrice(pair.koreanCode),
    fetchEtfPrice(pair.usEtf),
  ]);

  // Calculate premium
  const usEtfKrw = usPrice * usdKrw;
  const premiumPercent = ((koreanPrice - usEtfKrw) / usEtfKrw) * 100;

  // Generate recommendation
  let recommendation = "";
  if (premiumPercent > 2.0) {
    recommendation = "프리미엄 과대 (매도 고려)";
  } else if (premiumPercent < -2.0) {
    recommendation = "디스카운트 (매수 고려)";
  } else {
    recommendation = "정상 범위 (관망)";
  }

  return {
    pair,
    koreanPrice,
    usPrice,
    usdKrw,
    usEtfKrw,
    premiumPercent,
    recommendation,
  };
}

async function fetchEtfPremiumData(etfFilter: string): Promise<EtfData[]> {
  // Fetch exchange rate once
  const usdKrw = await fetchUsdKrw();

  // Determine which ETFs to analyze
  const pairsToAnalyze = etfFilter === "ALL" ? Object.values(ETF_PAIRS) : [ETF_PAIRS[etfFilter]];

  // Analyze all pairs in parallel
  const results = await Promise.all(pairsToAnalyze.map((pair) => analyzeEtfPair(pair, usdKrw)));

  return results;
}

function formatEtfPremiumReport(data: EtfData[], language: string): string {
  const isKorean = language === "ko";

  const header = isKorean ? "📊 국내 ETF 괴리율 추적" : "📊 Korean ETF Premium Tracker";

  const timestamp = new Date().toLocaleString(isKorean ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const etfReports = data
    .map((etf) => {
      const premiumSign = etf.premiumPercent >= 0 ? "+" : "";
      const premiumIndicator = etf.premiumPercent >= 0 ? "🔴" : "🔵";

      return `
${premiumIndicator} ${etf.pair.name} (${etf.pair.usEtf})

  ${etf.pair.koreanEtf}: ${etf.koreanPrice.toLocaleString("ko-KR")} 원
  ${etf.pair.usEtf}: $${etf.usPrice.toFixed(2)} (≈ ${etf.usEtfKrw.toLocaleString("ko-KR")} 원)
  
  괴리율: ${premiumSign}${etf.premiumPercent.toFixed(2)}%
  추천: ${isKorean ? etf.recommendation : translateRecommendation(etf.recommendation)}
      `.trim();
    })
    .join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

  const disclaimer = isKorean
    ? "\n\n💡 괴리율은 실시간 변동합니다. 거래 시 수수료 및 세금을 고려하세요."
    : "\n\n💡 Premium rates fluctuate in real-time. Consider fees and taxes when trading.";

  return `
${header}
━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp} KST

${etfReports}
${disclaimer}
  `.trim();
}

function translateRecommendation(rec: string): string {
  const translations: Record<string, string> = {
    "프리미엄 과대 (매도 고려)": "High premium (Consider selling)",
    "디스카운트 (매수 고려)": "Discount (Consider buying)",
    "정상 범위 (관망)": "Normal range (Wait and see)",
  };
  return translations[rec] || rec;
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const etf = request.etf || "ALL";
    const language = request.language || "ko";

    // Fetch ETF premium data
    const etfData = await fetchEtfPremiumData(etf);

    // Format output
    const report = formatEtfPremiumReport(etfData, language);

    return {
      deliverable: report,
      metadata: {
        timestamp: new Date().toISOString(),
        language,
        etf,
        results: etfData.map((d) => ({
          pair: d.pair.usEtf,
          premium: d.premiumPercent,
          recommendation: d.recommendation,
        })),
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error fetching ETF premium data: ${error.message}`,
      error: error.message,
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (request.etf && !["SPY", "QQQ", "ALL"].includes(request.etf)) {
    return {
      valid: false,
      reason: "Invalid ETF. Must be 'SPY', 'QQQ', or 'ALL'.",
    };
  }
  if (request.language && !["ko", "en"].includes(request.language)) {
    return {
      valid: false,
      reason: "Invalid language. Must be 'ko' or 'en'.",
    };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  const etf = request.etf || "ALL";
  const language = request.language || "ko";
  return language === "ko"
    ? `국내 ETF 괴리율 추적 (${etf}) - 매수/매도 타이밍 포착`
    : `Korean ETF Premium Tracker (${etf}) - Buy/Sell timing detection`;
}
