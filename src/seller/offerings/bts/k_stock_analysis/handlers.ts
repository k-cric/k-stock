import type { ExecuteJobResult, ValidationResult } from "../../../runtime/offeringTypes.js";

// Required: implement your service logic here
export async function executeJob(request: any): Promise<ExecuteJobResult> {
  try {
    // Get requested date or use today
    const requestedDate = request.date || new Date().toISOString().split("T")[0].replace(/-/g, "");

    // GitHub raw URL for CSV files
    const githubRawUrl = `https://raw.githubusercontent.com/k-cric/k-stock/main/results/ma_aligned_${requestedDate}.csv`;

    // Fetch CSV from GitHub
    const response = await fetch(githubRawUrl);

    if (!response.ok) {
      return {
        deliverable: `CSV file not found for date ${requestedDate}. Analysis may not have been run yet.`,
        error: "File not found",
      };
    }

    // Read CSV content
    const csvContent = await response.text();

    // Parse and format for better presentation
    const lines = csvContent.split("\n").slice(0, 51); // Header + top 50 rows
    const formattedContent =
      `K-Stock Analysis Report (${requestedDate})\n\n` +
      `이평선 정배열, RSI 과매수 제외 종목 (거래대금 순)\n\n` +
      lines.join("\n");

    return {
      deliverable: formattedContent,
      metadata: {
        date: requestedDate,
        totalRows: lines.length - 1,
        sourceUrl: githubRawUrl,
      },
    };
  } catch (error: any) {
    return {
      deliverable: `Error processing k-stock analysis: ${error.message}`,
      error: error.message,
    };
  }
}

// Optional: validate incoming requests
export function validateRequirements(request: any): ValidationResult {
  // Validate date format if provided
  if (request.date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request.date)) {
      return {
        valid: false,
        reason: "Invalid date format. Please use YYYY-MM-DD format.",
      };
    }
  }
  return { valid: true };
}

// Optional: provide custom payment request message
export function requestPayment(request: any): string {
  const date = request.date || "today";
  return `K-Stock Analysis for ${date} - Daily Korean stock screening based on MA alignment and RSI`;
}
