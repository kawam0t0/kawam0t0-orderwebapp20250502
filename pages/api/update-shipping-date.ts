import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

async function getAuthToken() {
  // 環境変数チェックを追加し、エラーメッセージを改善
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.warn("Google認証情報が設定されていません。")
    throw new Error("Google認証情報が設定されていません。")
  }

  try {
    // GOOGLE_APPLICATION_CREDENTIALS_JSONが設定されている場合、それを使用
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    }

    // 従来の方法（ファイルパス）
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  } catch (error) {
    console.error("Auth error:", error)
    throw error
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { orderNumber, shippingDate, sheetName } = req.body

    console.log(`=== Shipping Date Update Request ===`)
    console.log(`Order Number: ${orderNumber}`)
    console.log(`Shipping Date: ${shippingDate}`)
    console.log(`Sheet Name: ${sheetName}`)

    if (!orderNumber) {
      return res.status(400).json({ error: "Order number is required" })
    }

    // hirock_item_historyシートのみをサポート
    if (sheetName && sheetName !== "hirock_item_history") {
      return res.status(400).json({ error: "Only hirock_item_history sheet is supported" })
    }

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // 注文番号に一致する行を検索
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "hirock_item_history!A2:A",
    })

    if (!response.data.values) {
      return res.status(404).json({ error: "No orders found" })
    }

    // 注文番号に一致する行のインデックスを検索
    const rowIndex = response.data.values.findIndex((row) => row[0] === orderNumber)

    if (rowIndex === -1) {
      console.error(`Order ${orderNumber} not found in hirock_item_history`)
      return res.status(404).json({ error: "Order not found" })
    }

    // 実際のスプレッドシートの行番号（1-indexed）
    const actualRowIndex = rowIndex + 2 // ヘッダー行 + 0-indexedの調整

    const updateRange = `hirock_item_history!GX${actualRowIndex}` // GX列 = 出荷日列

    console.log(`Updating range: ${updateRange} with value: ${shippingDate}`)

    // 出荷日を更新
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[shippingDate || ""]],
      },
    })

    console.log(`Successfully updated shipping date for order ${orderNumber} to ${shippingDate}`)

    res.status(200).json({ success: true, message: `Shipping date updated to ${shippingDate}` })
  } catch (error) {
    console.error("Error updating shipping date:", error)
    res.status(500).json({
      error: "Failed to update shipping date",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
