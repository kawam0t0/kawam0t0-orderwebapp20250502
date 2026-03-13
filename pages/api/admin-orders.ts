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
    const regularResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Order_history!A2:AV", // AV列まで明示的に取得（AT列とAU列を含む）
    })

    // hirock_item_historyシートからデータを取得（範囲をBB/BC列まで拡張）
    const hirockResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "hirock_item_history!A2:BC", // BC列まで明示的に取得（BB列とBC列を含む）
    })

    const allOrders: any[] = []

    if (regularResponse.data.values) {
      regularResponse.data.values.forEach((row, index) => {
        const items: OrderItem[] = []
        for (let i = 5; i < Math.min(row.length, 33); i += 4) {
          if (row[i]) {
            items.push({
              name: row[i] || "",
              size: row[i + 1] || "",
              color: row[i + 2] || "",
              quantity: row[i + 3] || "1",
            })
          }
        }
        const shippingDate = row[45] || null // AT列
        const status = row[46] || null // AU列
        let finalStatus = "処理中"
        if (shippingDate) {
          finalStatus = status || "出荷済み"
        }

        allOrders.push({
          id: `reg-${index + 1}`,
          orderNumber: row[0] || `ORD-${(index + 1).toString().padStart(5, "0")}`,
          orderDate: row[1] || "",
          orderTime: row[2] || "",
          storeName: row[3] || "",
          email: row[4] || "",
          items,
          status: finalStatus,
          shippingDate: shippingDate,
          sourceSheet: "Order_history", // シート名を識別子として追加
        })
      })
    }

    if (hirockResponse.data.values) {
      hirockResponse.data.values.forEach((row, index) => {
        const items: OrderItem[] = []
        for (let i = 5; i < Math.min(row.length, 33); i += 4) {
          if (row[i]) {
            items.push({
              name: row[i] || "",
              size: row[i + 1] || "",
              color: row[i + 2] || "",
              quantity: row[i + 3] || "1",
            })
          }
        }
        const shippingDate = row[52] || null // BB列 (0-indexed 52)
        const status = row[53] || null // BC列 (0-indexed 53)
        let finalStatus = "処理中"
        if (shippingDate) {
          finalStatus = status || "出荷済み"
        }

        allOrders.push({
          id: `hirock-${index + 1}`,
          orderNumber: row[0] || `ORD-H-${(index + 1).toString().padStart(5, "0")}`,
          orderDate: row[1] || "",
          orderTime: row[2] || "",
          storeName: row[3] || "",
          email: row[4] || "",
          items,
          status: finalStatus,
          shippingDate: shippingDate,
          sourceSheet: "hirock_item_history", // シート名を識別子として追加
        })
      })
    }

    if (allOrders.length === 0) {
      return res.status(200).json({ orders: [], total: 0 })
    }

    // 発注番号ごとにグループ化
    const orderMap = new Map<string, any>()

    allOrders.forEach((order) => {
      const orderNumber = order.orderNumber
      if (!orderMap.has(orderNumber)) {
        orderMap.set(orderNumber, { ...order, items: [...order.items] })
      } else {
        const existingOrder = orderMap.get(orderNumber)!
        existingOrder.items = [...existingOrder.items, ...order.items]
        // ステータスが「出荷済み」の場合は優先
        if (order.status === "出荷済み") {
          existingOrder.status = "出荷済み"
          existingOrder.shippingDate = order.shippingDate
          existingOrder.sourceSheet = order.sourceSheet // 出荷済みになったシートを優先
        }
      }
    })

    const mergedOrders = Array.from(orderMap.values())

    // 検索条件に一致するデータをフィルタリング
    const filteredOrders = searchQuery
      ? mergedOrders.filter(
          (order) =>
            order.orderNumber.toLowerCase().includes(searchQuery) ||
            order.storeName.toLowerCase().includes(searchQuery) ||
            order.items.some((item) => item.name.toLowerCase().includes(searchQuery)),
        )
      : mergedOrders

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
