import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// メモリキャッシュ（簡易版）
let orderNumberCache: { [key: string]: number } = {}
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分間キャッシュ

async function getAuthToken() {
  console.log("Getting auth token...")

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error("Google credentials not found in environment variables")
    throw new Error("Google認証情報が設定されていません。")
  }

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log("Using GOOGLE_APPLICATION_CREDENTIALS_JSON")
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    }

    console.log("Using GOOGLE_APPLICATION_CREDENTIALS file")
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  } catch (error) {
    console.error("Auth error:", error)
    throw error
  }
}

async function getOrderRowIndex(sheets: any, orderNumber: string): Promise<number> {
  const now = Date.now()

  // キャッシュが有効で、該当の注文番号がキャッシュにある場合はそれを使用
  if (now - cacheTimestamp < CACHE_DURATION && orderNumberCache[orderNumber] !== undefined) {
    console.log(`Using cached row index for order ${orderNumber}: ${orderNumberCache[orderNumber]}`)
    return orderNumberCache[orderNumber]
  }

  // キャッシュが古い場合は更新
  if (now - cacheTimestamp >= CACHE_DURATION) {
    console.log("Cache expired, refreshing order number cache...")

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "hirock_item_history!A2:A",
      })

      if (!response.data.values) {
        console.error("No data found in hirock_item_history A column")
        throw new Error("No data found in hirock_item_history A column")
      }

      console.log(`Found ${response.data.values.length} rows in A column`)

      // キャッシュを更新
      orderNumberCache = {}
      response.data.values.forEach((row: string[], index: number) => {
        if (row[0]) {
          orderNumberCache[row[0]] = index + 2 // ヘッダー行 + 0-indexedの調整
        }
      })

      cacheTimestamp = now
      console.log(`Cache updated with ${Object.keys(orderNumberCache).length} order numbers`)
      console.log("First 5 cached order numbers:", Object.keys(orderNumberCache).slice(0, 5))
    } catch (error) {
      console.error("Error fetching order numbers for cache:", error)
      throw error
    }
  }

  const rowIndex = orderNumberCache[orderNumber]
  if (rowIndex === undefined) {
    console.error(`Order ${orderNumber} not found in cache`)
    console.log("Available orders in cache:", Object.keys(orderNumberCache).slice(0, 10))
    throw new Error(`Order ${orderNumber} not found`)
  }

  console.log(`Found order ${orderNumber} at row index ${rowIndex}`)
  return rowIndex
}

async function tryUpdateNotes(sheets: any, orderNumber: string, notes: string, rowIndex: number) {
  const updateRange = `hirock_item_history!GZ${rowIndex}` // GZ列 = 備考列
  console.log(`Updating notes range: ${updateRange}`)

  try {
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[notes || ""]],
      },
    })

    console.log(`Successfully updated notes in FC column for order ${orderNumber}`)
    return {
      success: true,
      column: "FC",
      range: updateRange,
      updatedCells: updateResponse.data.updatedCells,
    }
  } catch (error) {
    console.error(`Failed to update FC column:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`=== API Request Start ===`)
  console.log(`Method: ${req.method}`)
  console.log(`Body:`, req.body)

  if (req.method !== "POST") {
    console.log(`Method ${req.method} not allowed`)
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  }

  try {
    const { orderNumber, notes } = req.body

    console.log(`Processing notes update for order: ${orderNumber}`)
    console.log(`Notes content: "${notes}"`)

    // 入力検証
    if (!orderNumber) {
      console.error("Order number is missing")
      return res.status(400).json({ error: "Order number is required" })
    }

    if (!process.env.SHEET_ID) {
      console.error("SHEET_ID environment variable is not set")
      return res.status(500).json({ error: "Spreadsheet ID not configured" })
    }

    console.log(`Using spreadsheet ID: ${process.env.SHEET_ID}`)

    // 認証
    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    console.log("Google Sheets client initialized")

    // キャッシュを使用して行インデックスを取得
    const actualRowIndex = await getOrderRowIndex(sheets, orderNumber)

    // 利用可能な列を順番に試して更新
    const result = await tryUpdateNotes(sheets, orderNumber, notes, actualRowIndex)

    console.log("Successfully updated notes for order:", orderNumber)

    res.status(200).json({
      success: true,
      message: "Notes updated successfully",
      orderNumber,
      column: result.column,
      range: result.range,
      updatedCells: result.updatedCells,
    })
  } catch (error) {
    console.error("=== ERROR in update-order-notes ===")
    console.error("Error type:", error?.constructor?.name)
    console.error("Error message:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    // レート制限エラーの場合
    if (
      error instanceof Error &&
      (error.message.includes("Quota exceeded") ||
        error.message.includes("Rate limit") ||
        (error as any).status === 429)
    ) {
      console.log("Rate limit error detected")
      return res.status(429).json({
        error: "API quota exceeded. Please try again in a few minutes.",
        details: "Google Sheets API rate limit reached",
      })
    }

    // 認証エラーの場合
    if (
      error instanceof Error &&
      (error.message.includes("Invalid credentials") ||
        error.message.includes("Unauthorized") ||
        (error as any).status === 401)
    ) {
      console.log("Authentication error detected")
      return res.status(401).json({
        error: "Authentication failed",
        details: "Google Sheets API authentication error",
      })
    }

    // 保護されたセルエラーの場合
    if (
      error instanceof Error &&
      (error.message.includes("protected cell") || error.message.includes("All available columns are protected"))
    ) {
      console.log("Protected cell error detected")
      return res.status(403).json({
        error: "Cannot edit protected cells",
        details: "The notes columns are protected. Please contact the spreadsheet owner to remove protection.",
        suggestion: "Consider using a different approach or ask the spreadsheet owner to unprotect the notes columns.",
      })
    }

    // その他のエラー
    res.status(500).json({
      error: "Failed to update order notes",
      details: error instanceof Error ? error.message : "Unknown error",
      orderNumber: req.body?.orderNumber || "unknown",
    })
  }

  console.log(`=== API Request End ===`)
}
