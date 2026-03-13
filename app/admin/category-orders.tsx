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

    // Fetch data from Order_history sheet
    const orderHistoryResponse = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/sheets?sheet=Order_history`,
    )

    if (!orderHistoryResponse.ok) {
      throw new Error("Failed to fetch orders from Order_history")
    }

    const orderHistoryOrders = await orderHistoryResponse.json()

    // Fetch data from hirock_item_history sheet
    const hirockItemHistoryResponse = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/sheets?sheet=hirock_item_history`,
    )

    if (!hirockItemHistoryResponse.ok) {
      throw new Error("Failed to fetch orders from hirock_item_history")
    }

    const hirockItemHistoryOrders = await hirockItemHistoryResponse.json()

    const allOrders = [...orderHistoryOrders.orders, ...hirockItemHistoryOrders.orders]

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
    res
      .status(500)
      .json({ error: "Failed to fetch order data", details: error instanceof Error ? error.message : "Unknown error" })
  }
}
