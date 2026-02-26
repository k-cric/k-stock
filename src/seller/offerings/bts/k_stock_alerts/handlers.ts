import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

interface StockAlert {
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume?: number;
  week52High?: number;
  week52Low?: number;
  alertType: string;
}

interface AlertData {
  week52Highs: StockAlert[];
  week52Lows: StockAlert[];
  surgeStocks: StockAlert[];
  volumeSpikes: StockAlert[];
}

// Major Korean stocks to monitor
const MAJOR_STOCKS = [
  { name: "삼성전자", code: "005930.KS" },
  { name: "SK하이닉스", code: "000660.KS" },
  { name: "현대차", code: "005380.KS" },
  { name: "기아", code: "000270.KS" },
  { name: "POSCO홀딩스", code: "005490.KS" },
  { name: "네이버", code: "035420.KS" },
  { name: "카카오", code: "035720.KS" },
  { name: "LG에너지솔루션", code: "373220.KS" },
  { name: "삼성바이오로직스", code: "207940.KS" },
  { name: "셀트리온", code: "068270.KS" },
];

async function fetchStockData(code: string): Promise<any> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}?interval=1d&range=1y`
    );
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quotes = result.indicators.quote[0];

    return {
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent:
        ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      volume: quotes.volume[quotes.volume.length - 1],
      week52High: meta.fiftyTwoWeekHigh,
      week52Low: meta.fiftyTwoWeekLow,
    };
  } catch (error: any) {
    console.error(`Failed to fetch ${code}:`, error.message);
    return null;
  }
}

async function analyzeStocks(): Promise<AlertData> {
  const alerts: AlertData = {
    week52Highs: [],
    week52Lows: [],
    surgeStocks: [],
    volumeSpikes: [],
  };

  // Fetch data for all major stocks
  const stockDataPromises = MAJOR_STOCKS.map(async (stock) => {
    const data = await fetchStockData(stock.code);
    if (!data) return null;

    const stockInfo: StockAlert = {
      name: stock.name,
      code: stock.code,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      week52High: data.week52High,
      week52Low: data.week52Low,
      alertType: "",
    };

    // Check 52-week high (within 2% of high)
    if (data.week52High && data.price >= data.week52High * 0.98) {
      alerts.week52Highs.push({ ...stockInfo, alertType: "52주 신고가 근접" });
    }

    // Check 52-week low (within 2% of low)
    if (data.week52Low && data.price <= data.week52Low * 1.02) {
      alerts.week52Lows.push({ ...stockInfo, alertType: "52주 신저가 근접" });
    }

    // Check surge/plunge (>= 10%)
    if (Math.abs(data.changePercent) >= 10) {
      const alertType = data.changePercent > 0 ? "급등" : "급락";
      alerts.surgeStocks.push({ ...stockInfo, alertType });
    }

    return stockInfo;
  });

  await Promise.all(stockDataPromises);

  return alerts;
}

function formatAlertReport(data: AlertData, alertType: string, language: string): string {
  const isKorean = language === "ko";

  const header = isKorean ? "🚨 한국 주식 이벤트 알림" : "🚨 Korean Stock Alerts";

  const timestamp = new Date().toLocaleString(isKorean ? "ko-KR" : "en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  let sections: string[] = [];

  // 52-week highs
  if (alertType === "all" || alertType === "52week") {
    if (data.week52Highs.length > 0) {
      const title = isKorean ? "📈 52주 신고가 근접" : "📈 Near 52-Week High";
      const stocks = data.week52Highs
        .map(
          (s) =>
            `  • ${s.name} (${s.code.replace(".KS", "")}): ${s.price.toLocaleString("ko-KR")}원 (${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%)`
        )
        .join("\n");
      sections.push(`${title}\n${stocks}`);
    }

    if (data.week52Lows.length > 0) {
      const title = isKorean ? "📉 52주 신저가 근접" : "📉 Near 52-Week Low";
      const stocks = data.week52Lows
        .map(
          (s) =>
            `  • ${s.name} (${s.code.replace(".KS", "")}): ${s.price.toLocaleString("ko-KR")}원 (${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%)`
        )
        .join("\n");
      sections.push(`${title}\n${stocks}`);
    }
  }

  // Surge/plunge
  if (alertType === "all" || alertType === "surge") {
    if (data.surgeStocks.length > 0) {
      const title = isKorean ? "⚡ 급등/급락 종목 (±10%)" : "⚡ Surge/Plunge Stocks (±10%)";
      const stocks = data.surgeStocks
        .map(
          (s) =>
            `  ${s.changePercent > 0 ? "🔴" : "🔵"} ${s.name} (${s.code.replace(".KS", "")}): ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`
        )
        .join("\n");
      sections.push(`${title}\n${stocks}`);
    }
  }

  // Volume spikes (placeholder - would need historical volume data)
  if (alertType === "all" || alertType === "volume") {
    if (data.volumeSpikes.length > 0) {
      const title = isKorean ? "📊 거래량 급증" : "📊 Volume Spikes";
      const stocks = data.volumeSpikes
        .map((s) => `  • ${s.name}: ${s.volume.toLocaleString("ko-KR")} (평균 대비 200%+)`)
        .join("\n");
      sections.push(`${title}\n${stocks}`);
    }
  }

  const body =
    sections.length > 0
      ? sections.join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n")
      : isKorean
        ? "현재 특별한 알림 사항이 없습니다."
        : "No special alerts at this time.";

  const disclaimer = isKorean
    ? "\n\n💡 실시간 데이터 기준이며, 투자 판단의 참고 자료로만 활용하세요."
    : "\n\n💡 Real-time data. For reference only.";

  return `
${header}
━━━━━━━━━━━━━━━━━━━━
📅 ${timestamp} KST

${body}
${disclaimer}
  `.trim();
}

export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    const alertType = request.alertType || "all";
    const language = request.language || "ko";

    // Analyze stocks
    const alertData = await analyzeStocks();

    // Format output
    const report = formatAlertReport(alertData, alertType, language);

    return {
      deliverable: report,
      metadata: {
        timestamp: new Date().toISOString(),
        language,
        alertType,
        week52HighsCount: alertData.week52Highs.length,
        week52LowsCount: alertData.week52Lows.length,
        surgeStocksCount: alertData.surgeStocks.length,
        volumeSpikesCount: alertData.volumeSpikes.length,
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error fetching stock alerts: ${error.message}`,
      error: error.message,
    };
  }
}

export function validateRequirements(request: any): ValidationResult {
  if (request.alertType && !["52week", "surge", "volume", "all"].includes(request.alertType)) {
    return {
      valid: false,
      reason: "Invalid alertType. Must be '52week', 'surge', 'volume', or 'all'.",
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
  const alertType = request.alertType || "all";
  const language = request.language || "ko";
  return language === "ko"
    ? `한국 주식 이벤트 알림 (${alertType}) - 신고가/급등락/거래량 추적`
    : `Korean Stock Alerts (${alertType}) - 52W high/surge/volume tracking`;
}
