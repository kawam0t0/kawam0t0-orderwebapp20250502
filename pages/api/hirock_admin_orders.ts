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
  } catch (error: any) {
    // Explicitly type as unknown
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

    console.log(`Fetching hirock orders with page=${pageNumber}, limit=${limitNumber}, search=${searchQuery}`)

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // hirock_item_historyシートからデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "hirock_item_history!A2:BC", // BC列まで明示的に取得
    })

    if (!response.data.values) {
      console.log("No data found in hirock_item_history sheet")
      return res.status(200).json({ orders: [], total: 0, page: pageNumber, limit: limitNumber, totalPages: 0 })
    }

    console.log(`Found ${response.data.values.length} rows in hirock_item_history sheet`)

    // 発注データを整形
    const allOrders = response.data.values.map((row, index) => {
      // 商品情報を抽出 (I列からO列までが商品情報、P列が合計金額)
      // hirock_item_historyの列構成に合わせて調整
      // I: カテゴリー (8)
      // J: 商品名 (9)
      // K: カラー (10)
      // L: サイズ (11)
      // M: 数量 (12)
      // N: 単価 (13)
      // O: 納期 (14)
      const items: OrderItem[] = [] // 明示的に型を指定
      // 新店舗パックのアイテムは個別に保存されるため、各行が1つのアイテムに対応すると仮定
      // したがって、items配列にはその行のアイテムのみが含まれる
      items.push({
        name: row[9] || "", // J列: 商品名
        size: row[11] || "", // L列: サイズ
        color: row[10] || "", // K列: カラー
        quantity: row[12] || "1", // M列: 数量
      })

      // 出荷日とステータスを取得（BB列とBC列）
      const shippingDate = row[52] || null // BB列（53番目、0から始まるので52）
      const status = row[53] || null // BC列（54番目、0から始まるので53）

      // デフォルトステータスを設定
      let finalStatus = "処理中"
      if (shippingDate) {
        finalStatus = status || "出荷済み"
      }

      return {
        id: index + 1,
        orderNumber: row[1] || `ORD-${(index + 1).toString().padStart(5, "0")}`, // B列が発注番号
        orderDate: row[0] || "", // A列が発注日時
        orderTime: "", // hirock_item_historyには時間列がないため空
        storeName: row[2] || "", // C列が店舗名
        email: row[4] || "", // E列がメールアドレス
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
    console.log("Fetched hirock orders:", {
      total: filteredOrders.length,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(filteredOrders.length / limitNumber),
      sampleOrder:
        paginatedOrders.length > 0
          ? {
              orderNumber: paginatedOrders[0].orderNumber,
              items: paginatedOrders[0].items.map((item) => item.name),
            }
          : "No orders",
    })

    res.status(200).json({
      orders: paginatedOrders,
      total: filteredOrders.length,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(filteredOrders.length / limitNumber),
    })
  } catch (error: any) {
    // Explicitly type as unknown
    console.error("Error fetching hirock admin orders:", error)
    res.status(500).json({
      error: "Failed to fetch order data",
      details: error.message,
    })
  }
}
