import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// Define the OrderItem type
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
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { page = "1", limit = "30", search = "" } = req.query

    const pageNumber = Number.parseInt(page as string, 10)
    const limitNumber = Number.parseInt(limit as string, 10)
    const searchQuery = (search as string).toLowerCase()

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // Order_historyシートからデータを取得（範囲を明示的に指定）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Order_history!A2:AV", // AV列まで明示的に取得（AT列とAU列を含む）
    })

    if (!response.data.values) {
      return res.status(200).json({ orders: [], total: 0 })
    }

    // 発注データを整形
    const allOrders = response.data.values.map((row, index) => {
      // 商品情報を抽出
      const items: OrderItem[] = [] // 明示的に型を指定
      for (let i = 5; i < Math.min(row.length, 33); i += 4) {
        // 商品情報は33列目まで
        if (row[i]) {
          items.push({
            name: row[i] || "",
            size: row[i + 1] || "",
            color: row[i + 2] || "",
            quantity: row[i + 3] || "1",
          })
        }
      }

      // 出荷日とステータスを取得（AT列とAU列）
      const shippingDate = row[45] || null // AT列（46番目、0から始まるので45）
      const status = row[46] || null // AU列（47番目、0から始まるので46）

      // デフォルトステータスを設定
      let finalStatus = "処理中"
      if (shippingDate) {
        finalStatus = status || "出荷済み"
      }

      return {
        id: index + 1,
        orderNumber: row[0] || `ORD-${(index + 1).toString().padStart(5, "0")}`,
        orderDate: row[1] || "",
        orderTime: row[2] || "",
        storeName: row[3] || "",
        email: row[4] || "",
        items,
        status: finalStatus,
        shippingDate: shippingDate, // 出荷日をそのまま保持
      }
    })

    // 検索条件に一致するデータをフィルタリング
    const filteredOrders = searchQuery
      ? allOrders.filter(
          (order) =>
            order.orderNumber.toLowerCase().includes(searchQuery) ||
            order.storeName.toLowerCase().includes(searchQuery) ||
            order.items.some((item) => item.name.toLowerCase().includes(searchQuery)),
        )
      : allOrders

    // ページネーション
    const startIndex = (pageNumber - 1) * limitNumber
    const endIndex = startIndex + limitNumber
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

    // レスポンスを返す前にデータをログ出力（デバッグ用）
    console.log("Fetched orders:", {
      total: filteredOrders.length,
      sample: paginatedOrders[0],
    })

    res.status(200).json({
      orders: paginatedOrders,
      total: filteredOrders.length,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(filteredOrders.length / limitNumber),
    })
  } catch (error) {
    console.error("Error fetching admin orders:", error)
    res.status(500).json({
      error: "Failed to fetch order data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

