import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// 注文アイテムの型定義
type OrderItem = {
  name: string
  size: string
  color: string
  quantity: string
}

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
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      })
    }

    // 従来の方法（ファイルパス）
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
  } catch (error) {
    console.error("Auth error:", error)
    throw error
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { orderNumber } = req.query

    if (!orderNumber) {
      return res.status(400).json({ error: "Order number is required" })
    }

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // hirock_item_historyシートから該当する注文を検索
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "hirock_item_history!A2:AV",
    })

    if (!response.data.values) {
      return res.status(404).json({ error: "No orders found" })
    }

    // 注文番号に一致する行を検索
    const orderRow = response.data.values.find((row) => row[0] === orderNumber)

    if (!orderRow) {
      return res.status(404).json({ error: "Order not found" })
    }

    // 商品情報を抽出
    const items: OrderItem[] = []
    for (let i = 5; i < Math.min(orderRow.length, 33); i += 4) {
      // 商品名が存在する場合のみ追加
      if (orderRow[i]) {
        items.push({
          name: orderRow[i] || "",
          size: orderRow[i + 1] || "",
          color: orderRow[i + 2] || "",
          quantity: orderRow[i + 3] || "1",
        })
      }
    }

    // 店舗名とメールアドレスも取得
    const storeName = orderRow[3] || ""
    const email = orderRow[4] || ""

    res.status(200).json({
      orderNumber,
      storeName,
      email,
      items,
    })
  } catch (error) {
    console.error("Error fetching hirock order items:", error)
    res.status(500).json({
      error: "Failed to fetch order items",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
