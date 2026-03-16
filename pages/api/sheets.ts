import { google } from "googleapis"
import type { NextApiRequest, NextApiResponse } from "next"

// 修正箇所1: 型定義を追加
// 関数の前に以下の型定義を追加
type GroupedItem = {
  id: string
  category: string
  name: string
  colors: string[]
  sizes: string[]
  amounts: number[]
  prices: string[]
  pricesPerPiece: string[]
  leadTime: string
  partnerName: string
  partnerEmail: string
  imageUrl: string // 画像URLを追加
  color: string
}

// キャッシュ機能を追加
const dataCache: { [key: string]: any } = {}
const cacheTimestamps: { [key: string]: number } = {}
const CACHE_DURATION = 2 * 60 * 1000 // 2分間キャッシュ

// Google DriveのURLを直接表示可能な形式に変換する関数
function convertGoogleDriveUrl(url: string): string {
  try {
    if (!url) return ""
    // /file/d/FILE_ID/ 形式
    const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch && fileMatch[1]) {
      return `https://drive.google.com/thumbnail?sz=w800&id=${fileMatch[1]}`
    }
    // すでに ?id= 形式（/uc?export=view&id= など）の場合も thumbnail に変換
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/thumbnail?sz=w800&id=${idMatch[1]}`
    }
    return url
  } catch (error) {
    console.error("Error converting Google Drive URL:", error)
    return ""
  }
}

async function getAuthToken() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.warn("Google認証情報が設定されていません。")
    throw new Error("Google認証情報が設定されていません。")
  }

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    }

    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  } catch (error) {
    console.error("Auth error:", error)
    throw error
  }
}

// キャッシュからデータを取得する関数
function getCachedData(cacheKey: string): any | null {
  const now = Date.now()
  if (dataCache[cacheKey] && cacheTimestamps[cacheKey] && now - cacheTimestamps[cacheKey] < CACHE_DURATION) {
    console.log(`Using cached data for: ${cacheKey}`)
    return dataCache[cacheKey]
  }
  return null
}

// データをキャッシュに保存する関数
function setCachedData(cacheKey: string, data: any): void {
  dataCache[cacheKey] = data
  cacheTimestamps[cacheKey] = Date.now()
  console.log(`Data cached for: ${cacheKey}`)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sheet } = req.query

  if (!sheet || typeof sheet !== "string") {
    return res.status(400).json({ error: "Sheet name is required" })
  }

  if (req.method === "GET") {
    const cacheKey = `sheet_${sheet}`

    // キャッシュをチェック（空配列はキャッシュしない）
    const cachedData = getCachedData(cacheKey)
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      return res.status(200).json(cachedData)
    }

    if (!process.env.SHEET_ID) {
      console.error("SHEET_ID is not set in environment variables")
      // テスト用のダミーデータを返す
      if (sheet === "store_info!A2:G") {
        return res.status(200).json([
          ["store1", "テスト店舗1", "100-0001", "東京都渋谷区", "03-1234-5678", "test1@example.com", "password1"],
          ["store2", "テスト店舗2", "530-0001", "大阪府大阪市", "06-1234-5678", "test2@example.com", "password2"],
        ])
      }
      return res.status(200).json([
        ["store1", "テスト店舗1", "東京都渋谷区", "03-1234-5678", "山田太郎", "test1@example.com"],
        ["store2", "テスト店舗2", "大阪府大阪市", "06-1234-5678", "佐藤次郎", "test2@example.com"],
      ])
    }

    try {
      console.log("[v0] SHEET_ID:", process.env.SHEET_ID)
      console.log("[v0] sheet param:", sheet)
      console.log("[v0] GOOGLE_APPLICATION_CREDENTIALS_JSON exists:", !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      const auth = await getAuthToken()
      const sheets = google.sheets({
        version: "v4",
        auth,
      })

      let range: string
      let processData: (data: any[][]) => any[]

      switch (sheet) {
        case "Available_items":
          range = "Available_items!A2:Z"
          processData = (data) => {
            // 商品名+色でグループ化して1カード=1商品にする
            const groupMap: { [key: string]: any } = {}

            data
              .filter((row) => row[0])
              .forEach((row, index) => {
                const category = row[1] || row[0] || ""
                const name = row[2] || ""
                const color = row[3] || ""
                const size = row[4] || ""
                const price = row[6] || ""
                const leadTime = row[7] || ""
                const partnerName = row[8] || ""
                const partnerEmail = row[9] || ""
                const imageUrl = row[10] ? convertGoogleDriveUrl(row[10]) : ""

                // 商品名+色をキーとしてグループ化
                const groupKey = `${name}__${color}`

                if (!groupMap[groupKey]) {
                  groupMap[groupKey] = {
                    id: `item-${Object.keys(groupMap).length}`,
                    category,
                    name,
                    color,
                    selectedColor: color,
                    colors: [color],
                    sizes: [],
                    prices: [],
                    amounts: [1],
                    item_price: price,
                    pricesPerPiece: [price],
                    leadTime,
                    partnerName,
                    partnerEmail,
                    imageUrl,
                  }
                }

                // サイズと価格を追加（重複しない場合のみ）
                if (size && !groupMap[groupKey].sizes.includes(size)) {
                  groupMap[groupKey].sizes.push(size)
                  groupMap[groupKey].prices.push(price)
                }
              })

            return Object.values(groupMap)
          }
          break

        case "hirock_item_history":
          // 新構造: 最大50アイテム
          // A-E: 基本情報
          // F(5)〜GW(204): アイテム情報 50アイテム × 4列
          // GX(205): shipping_date
          // GY(206): status
          // GZ(207): 備考
          range = "hirock_item_history!A2:GZ"
          processData = (data) => {
            const ordersMap: { [key: string]: any } = {}
            const MAX_ITEMS = 50
            const BASE_COLS = 5
            const COLS_PER_ITEM = 4
            const SHIPPING_DATE_COL = BASE_COLS + MAX_ITEMS * COLS_PER_ITEM // 205 = GX
            const STATUS_COL = SHIPPING_DATE_COL + 1                        // 206 = GY
            const NOTES_COL = STATUS_COL + 1                                // 207 = GZ

            data
              .filter((row) => row[0])
              .forEach((row) => {
                const orderNumber = row[0]
                if (!ordersMap[orderNumber]) {
                  const items: { name: string; size: string; color: string; quantity: string }[] = []
                  for (let i = 0; i < MAX_ITEMS; i++) {
                    const colBase = BASE_COLS + i * COLS_PER_ITEM
                    const itemName = row[colBase]
                    if (itemName && itemName.trim()) {
                      items.push({
                        name: itemName,
                        size: row[colBase + 1] || "",
                        color: row[colBase + 2] || "",
                        quantity: row[colBase + 3] || "",
                      })
                    }
                  }

                  const rawStatus = typeof row[STATUS_COL] === "string" ? row[STATUS_COL] : ""
                  const shippingDate = typeof row[SHIPPING_DATE_COL] === "string" ? row[SHIPPING_DATE_COL] : ""
                  const notes = typeof row[NOTES_COL] === "string" ? row[NOTES_COL] : ""

                  let status = "処理中"
                  if (rawStatus && rawStatus.trim() !== "") {
                    status = rawStatus.trim()
                  } else if (shippingDate && shippingDate.trim() !== "") {
                    status = "出荷済み"
                  }

                  ordersMap[orderNumber] = {
                    orderNumber,
                    orderDate: row[1] || "",
                    orderTime: row[2] || "",
                    storeName: row[3] || "",
                    email: row[4] || "",
                    items,
                    status,
                    shippingDate: shippingDate || null,
                    sourceSheet: "hirock_item_history",
                    notes,
                  }
                }
              })

            return Object.values(ordersMap)
          }
          break

        case "partner_info":
          range = "partner_info!A2:Z"
          processData = (data) =>
            data
              .filter((row) => row[0])
              .map((row) => ({
                id: row[0] || "",
                name: row[1] || "",
                email: row[2] || "",
                phone: row[3] || "",
                address: row[4] || "",
              }))
          break

        case "Order_history":
          range = "Order_history!A2:GZ"
          processData = (data) => {
            const MAX_ITEMS = 50
            const BASE_COLS = 5   // A〜E: id, date, time, store_name, mail
            const COLS_PER_ITEM = 4 // item_name, size, color, quantity
            const ordersMap: { [key: string]: any } = {}

            data
              .filter((row) => row[0])
              .forEach((row) => {
                const orderNumber = row[0]
                if (!ordersMap[orderNumber]) {
                  const items: { name: string; size: string; color: string; quantity: string }[] = []
                  for (let i = 0; i < MAX_ITEMS; i++) {
                    const colBase = BASE_COLS + i * COLS_PER_ITEM
                    const itemName = row[colBase]
                    if (itemName && itemName.trim()) {
                      items.push({
                        name: itemName,
                        size: row[colBase + 1] || "",
                        color: row[colBase + 2] || "",
                        quantity: row[colBase + 3] || "",
                      })
                    }
                  }
                  ordersMap[orderNumber] = {
                    orderNumber,
                    orderDate: row[1] || "",
                    orderTime: row[2] || "",
                    storeName: row[3] || "",
                    email: row[4] || "",
                    items,
                    status: row[BASE_COLS + MAX_ITEMS * COLS_PER_ITEM + 1] || "処理中",
                    shippingDate: row[BASE_COLS + MAX_ITEMS * COLS_PER_ITEM] || null,
                    sourceSheet: "Order_history",
                  }
                }
              })
            return Object.values(ordersMap)
          }
          break

        case "machine_item":
          range = "machine_item!A2:Z"
          processData = (data) =>
            data
              .filter((row) => row[0])
              .map((row, index) => ({
                id: `machine-${index}`,
                category: row[0] || "",
                name: row[1] || "",
                description: row[2] || "",
                price: row[3] || "",
                imageUrl: row[4] ? convertGoogleDriveUrl(row[4]) : "",
              }))
          break

        case "machine_item_history":
          range = "machine_item_history!A2:Z"
          processData = (data) =>
            data
              .filter((row) => row[0])
              .map((row) => ({
                orderNumber: row[0] || "",
                orderDate: row[1] || "",
                orderTime: row[2] || "",
                storeName: row[3] || "",
                email: row[4] || "",
                itemName: row[5] || "",
                quantity: row[6] || "",
                status: row[7] || "処理中",
                sourceSheet: "machine_item_history",
              }))
          break

        case "store_info!A2:G":
        case "store_info":
          range = "store_info!A2:G"
          processData = (data) =>
            data
              .filter((row) => row[0])
              .map((row) => ({
                id: row[0] || "",
                name: row[1] || "",
                phone: row[2] || "",
                postalCode: row[3] || "",
                address: row[4] || "",
                email: row[5] || "",
                password: row[6] || "",
              }))
          break

        default:
          // sheetがrangeとして直接渡された場合の処理
          range = sheet
          processData = (data) => data
          break
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range,
      })

      if (!response.data.values) {
        console.log("[v0] No data returned from sheet:", range)
        return res.json([])
      }

      console.log("[v0] Raw data rows count:", response.data.values.length)
      console.log("[v0] First row sample:", response.data.values[0])

      const processedData = processData(response.data.values)
      console.log("[v0] Processed data count:", processedData.length)
      setCachedData(cacheKey, processedData)
      res.status(200).json(processedData)
    } catch (error) {
      console.error("Error fetching sheet data:", error)

      // レート制限エラーの場合
      if (error instanceof Error && error.message.includes("Quota exceeded")) {
        return res.status(429).json({
          error: "API quota exceeded. Please try again in a few minutes.",
          details: "Google Sheets API rate limit reached",
        })
      }

      res.status(500).json({
        error: "Failed to fetch sheet data",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } else {
    res.setHeader("Allow", ["GET"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
