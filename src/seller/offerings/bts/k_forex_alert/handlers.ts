import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface ForexData {
  usdKrw: {
    rate: number;
    change: number;
    changePercent: number;
  };
  kimchiPremium: {
    upbitPrice: number;
    binancePrice: number;
    upbitKrw: number;
    premiumPercent: number;
    arbitrageOpportunity: boolean;
  };
  asset: string;
}

async function fetchUsdKrw(): Promise<{ rate: number; change: number; changePercent: number }> {
  try {
    const response = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d"
    );
    const data = await response.json();
    const quote = data.chart.result[0].meta;

    const rate = quote.regularMarketPrice;
    const prevClose = quote.chartPreviousClose;
    const change = rate - prevClose;
    const changePercent = (change / prevClose) * 100;

    return { rate, change, changePercent };
  } catch (error: any) {
    throw new Error(`Failed to fetch USD/KRW: ${error.message}`);
  }
}

async function fetchUpbitPrice(asset: string): Promise<number> {
  try {
    const market = `KRW-${asset}`;
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error(`No data for ${market} on Upbit`);
    }

    return data[0].trade_price;
  } catch (error: any) {
    throw new Error(`Failed to fetch Upbit price: ${error.message}`);
  }
}

async function fetchBinancePrice(asset: string): Promise<number> {
  try {
    const symbol = `${asset}USDT`;
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const data = await response.json();

    if (!data || !data.price) {
      throw new Error(`No data for ${symbol} on Binance`);
    }

    return parseFloat(data.price);
  } catch (error: any) {
    throw new Error(`Failed to fetch Binance price: ${error.message}`);
  }
}

async function fetchForexData(asset: string): Promise<ForexData> {
  // Fetch all data in parallel
  const [usdKrw, upbitPrice, binancePrice] = await Promise.all([
    fetchUsdKrw(),
    fetchUpbitPrice(asset),
    fetchBinancePrice(asset),
  ]);

  // Calculate kimchi premium
  const upbitKrw = upbitPrice;
  const binancePriceKrw = binancePrice * usdKrw.rate;
  const premiumPercent = ((upbitKrw - binancePriceKrw) / binancePriceKrw) * 100;
  const arbitrageOpportunity = Math.abs(premiumPercent) > 1.0; // Alert if >1% difference

  return {
    usdKrw,
    kimchiPremium: {
      upbitPrice: upbitKrw,
      binancePrice: binancePrice,
      upbitKrw: upbitKrw,
      premiumPercent,
      arbitrageOpportunity,
    },
    asset,
  };
}

function formatForexAlert(data: ForexData, language: string): string {
  const isKorean = language === "ko";

  const header = isKorean ? "🌏 환율 & 김치 프리미엄 추적" : "🌏 Forex & Kimchi Premium Alert";

  const timestamp = new Date().toLocaleString(isKorean ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? "+" : "";
    const arrow = change >= 0 ? "📈" : "📉";
    return `${arrow} ${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const forexLabel = isKorean ? "원/달러 환율" : "USD/KRW Exchange Rate";
  const kimchiLabel = isKorean ? "김치 프리미엄" : "Kimchi Premium";

  const upbitLabel = isKorean ? "업비트" : "Upbit";
  const binanceLabel = isKorean ? "바이낸스" : "Binance";

  const premiumSign = data.kimchiPremium.premiumPercent >= 0 ? "+" : "";
  const premiumArrow = data.kimchiPremium.premiumPercent >= 0 ? "🔴" : "🔵";

  let opportunityMsg = "";
  if (data.kimchiPremium.arbitrageOpportunity) {
    opportunityMsg = isKorean
      ? `\n⚠️ 차익거래 기회! (${Math.abs(data.kimchiPremium.premiumPercent).toFixed(2)}% 차이)`
      : `\n⚠️ Arbitrage opportunity! (${Math.abs(data.kimchiPremium.premiumPercent).toFixed(2)}% difference)`;
  }

  const disclaimer = isKorean
    ? "\n💡 실시간 데이터 기준이며, 거래 시 수수료 및 슬리피지를 고려하세요."
    : "\n💡 Real-time data. Consider fees and slippage when trading.";

  return `
${header}
━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp} KST

💵 ${forexLabel}: ${data.usdKrw.rate.toFixed(2)} KRW
   ${formatChange(data.usdKrw.change, data.usdKrw.changePercent)}

${premiumArrow} ${kimchiLabel} (${data.asset}):

  ${upbitLabel}: ${data.kimchiPremium.upbitKrw.toLocaleString("ko-KR")} KRW
  ${binanceLabel}: $${data.kimchiPremium.binancePrice.toLocaleString("en-US")} (≈ ${(data.kimchiPremium.binancePrice * data.usdKrw.rate).toLocaleString("ko-KR")} KRW)
  
  프리미엄: ${premiumSign}${data.kimchiPremium.premiumPercent.toFixed(2)}%${opportunityMsg}
${disclaimer}
  `.trim();
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const asset = request.asset || "BTC";
    const language = request.language || "ko";

    // Fetch forex data
    const forexData = await fetchForexData(asset);

    // Format output
    const alert = formatForexAlert(forexData, language);

    return {
      deliverable: alert,
      metadata: {
        timestamp: new Date().toISOString(),
        language,
        asset,
        usdKrwRate: forexData.usdKrw.rate,
        kimchiPremium: forexData.kimchiPremium.premiumPercent,
        arbitrageOpportunity: forexData.kimchiPremium.arbitrageOpportunity,
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error fetching forex data: ${error.message}`,
      error: error.message,
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (request.asset && !["BTC", "ETH"].includes(request.asset)) {
    return {
      valid: false,
      reason: "Invalid asset. Must be 'BTC' or 'ETH'.",
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
  const asset = request.asset || "BTC";
  const language = request.language || "ko";
  return language === "ko"
    ? `환율 & 김치 프리미엄 추적 (${asset}) - 차익거래 기회 포착`
    : `Forex & Kimchi Premium Alert (${asset}) - Arbitrage opportunity detection`;
}
