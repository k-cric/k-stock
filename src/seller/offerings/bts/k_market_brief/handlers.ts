import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface MarketData {
  kospi: { price: number; change: number; changePercent: number };
  kosdaq: { price: number; change: number; changePercent: number };
  usdKrw: { rate: number; change: number; changePercent: number };
  topStocks: Array<{ name: string; code: string; volume: string; price: string }>;
}

async function fetchKoreanMarketData(): Promise<MarketData> {
  try {
    // Fetch KOSPI and KOSDAQ from Yahoo Finance
    const kospiResponse = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=1d"
    );
    const kosdaqResponse = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EKQ11?interval=1d&range=1d"
    );

    const kospiData = await kospiResponse.json();
    const kosdaqData = await kosdaqResponse.json();

    const kospiQuote = kospiData.chart.result[0].meta;
    const kosdaqQuote = kosdaqData.chart.result[0].meta;

    // Fetch USD/KRW exchange rate
    const forexResponse = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d"
    );
    const forexData = await forexResponse.json();
    const forexQuote = forexData.chart.result[0].meta;

    // Parse KOSPI
    const kospiPrice = kospiQuote.regularMarketPrice;
    const kospiPrevClose = kospiQuote.chartPreviousClose;
    const kospiChange = kospiPrice - kospiPrevClose;
    const kospiChangePercent = (kospiChange / kospiPrevClose) * 100;

    // Parse KOSDAQ
    const kosdaqPrice = kosdaqQuote.regularMarketPrice;
    const kosdaqPrevClose = kosdaqQuote.chartPreviousClose;
    const kosdaqChange = kosdaqPrice - kosdaqPrevClose;
    const kosdaqChangePercent = (kosdaqChange / kosdaqPrevClose) * 100;

    // Parse USD/KRW
    const usdKrwRate = forexQuote.regularMarketPrice;
    const usdKrwPrevClose = forexQuote.chartPreviousClose;
    const usdKrwChange = usdKrwRate - usdKrwPrevClose;
    const usdKrwChangePercent = (usdKrwChange / usdKrwPrevClose) * 100;

    // Top stocks (placeholder - will enhance later)
    const topStocks = [
      { name: "삼성전자", code: "005930", volume: "N/A", price: "N/A" },
      { name: "SK하이닉스", code: "000660", volume: "N/A", price: "N/A" },
      { name: "현대차", code: "005380", volume: "N/A", price: "N/A" },
      { name: "기아", code: "000270", volume: "N/A", price: "N/A" },
      { name: "POSCO홀딩스", code: "005490", volume: "N/A", price: "N/A" },
    ];

    return {
      kospi: {
        price: kospiPrice,
        change: kospiChange,
        changePercent: kospiChangePercent,
      },
      kosdaq: {
        price: kosdaqPrice,
        change: kosdaqChange,
        changePercent: kosdaqChangePercent,
      },
      usdKrw: {
        rate: usdKrwRate,
        change: usdKrwChange,
        changePercent: usdKrwChangePercent,
      },
      topStocks,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch market data: ${error.message}`);
  }
}

function formatMarketBrief(data: MarketData, language: string): string {
  const isKorean = language === "ko";

  const header = isKorean ? "🇰🇷 한국 시장 브리핑" : "🇰🇷 Korean Market Brief";

  const timestamp = new Date().toLocaleString(isKorean ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const kospiLabel = "KOSPI";
  const kosdaqLabel = "KOSDAQ";
  const forexLabel = isKorean ? "원/달러 환율" : "USD/KRW";

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? "+" : "";
    const arrow = change >= 0 ? "📈" : "📉";
    return `${arrow} ${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const topStocksLabel = isKorean ? "거래대금 상위 종목" : "Top Traded Stocks";
  const topStocksList = data.topStocks
    .map((stock, idx) => `${idx + 1}. ${stock.name} (${stock.code})`)
    .join("\n");

  const disclaimer = isKorean
    ? "\n💡 실시간 데이터 기준이며, 투자 판단의 참고 자료로만 활용하세요."
    : "\n💡 Real-time data. For reference only.";

  return `
${header}
━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp} KST

📊 ${kospiLabel}: ${data.kospi.price.toFixed(2)}
   ${formatChange(data.kospi.change, data.kospi.changePercent)}

📊 ${kosdaqLabel}: ${data.kosdaq.price.toFixed(2)}
   ${formatChange(data.kosdaq.change, data.kosdaq.changePercent)}

💵 ${forexLabel}: ${data.usdKrw.rate.toFixed(2)} KRW
   ${formatChange(data.usdKrw.change, data.usdKrw.changePercent)}

🔥 ${topStocksLabel}:
${topStocksList}
${disclaimer}
  `.trim();
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const language = request.language || "ko";

    // Fetch market data
    const marketData = await fetchKoreanMarketData();

    // Format output
    const brief = formatMarketBrief(marketData, language);

    return {
      deliverable: brief,
      metadata: {
        timestamp: new Date().toISOString(),
        language,
        kospiPrice: marketData.kospi.price,
        kosdaqPrice: marketData.kosdaq.price,
        usdKrwRate: marketData.usdKrw.rate,
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error fetching Korean market data: ${error.message}`,
      error: error.message,
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (request.language && !["ko", "en"].includes(request.language)) {
    return {
      valid: false,
      reason: "Invalid language. Must be 'ko' or 'en'.",
    };
  }
  return { valid: true };
}

export function requestPayment(request: any): string {
  const language = request.language || "ko";
  return language === "ko"
    ? "한국 시장 브리핑 - 실시간 KOSPI/KOSDAQ/환율 정보"
    : "Korean Market Brief - Real-time KOSPI/KOSDAQ/Forex data";
}
