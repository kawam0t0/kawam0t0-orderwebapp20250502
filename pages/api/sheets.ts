import { google } from "googleapis"
import type { NextApiRequest, NextApiResponse } from "next"

const dataCache: { [key: string]: any } = {}
const cacheTimestamps: { [key: string]: number } = {}
const CACHE_DURATION = 2 * 60 * 1000

function convertGoogleDriveUrl(url: string): string {
  try {
    if (!url) return ""

    const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (fileMatch && fileMatch[1]) {
      return `https://drive.google.com/thumbnail?sz=w800&id=${fileMatch[1]}`
    }

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
    throw new Error("Google認証情報が設定されていません。")
  }

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
}

function getCachedData(cacheKey: string): any | null {
  const now = Date.now()

  if (dataCache[cacheKey] && cacheTimestamps[cacheKey] && now - cacheTimestamps[cacheKey] < CACHE_DURATION) {
    return dataCache[cacheKey]
  }

  return null
}

function setCachedData(cacheKey: string, data: any): void {
  dataCache[cacheKey] = data
  cacheTimestamps[cacheKey] = Date.now()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sheet } = req.query

  if (!sheet || typeof sheet !== "string") {
    return res.status(400).json({ error: "Sheet name is required" })
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const cacheableSheets = ["Available_items", "store_info", "store_info!A2:G", "partner_info", "machine_item"]

  if (cacheableSheets.includes(sheet)) {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600")
  } else {
    res.setHeader("Cache-Control", "no-store")
  }

  const cacheKey = `sheet_${sheet}`

  const cachedData = getCachedData(cacheKey)
  if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
    return res.status(200).json(cachedData)
  }

  if (!process.env.SHEET_ID) {
    console.error("SHEET_ID is not set in environment variables")
    return res.status(500).json({ error: "SHEET_ID is not set" })
  }

  try {
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
          const groupMap: { [key: string]: any } = {}

          data
            .filter((row) => row[0])
            .forEach((row) => {
              const category = row[1] || row[0] || ""
              const name = row[2] || ""
              const color = row[3] || ""
              const size = row[4] || ""
              const price = row[6] || ""
              const leadTime = row[7] || ""
              const partnerName = row[8] || ""
              const partnerEmail = row[9] || ""
              const imageUrl = row[10] ? convertGoogleDriveUrl(row[10]) : ""

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

              if (size && !groupMap[groupKey].sizes.includes(size)) {
                groupMap[groupKey].sizes.push(size)
                groupMap[groupKey].prices.push(price)
              }
            })

          return Object.values(groupMap)
        }
        break

      case "hirock_item_history":
        range = "hirock_item_history!A2:GZ"
        processData = (data) => {
          const ordersMap: { [key: string]: any } = {}

          const MAX_ITEMS = 50
          const BASE_COLS = 5
          const COLS_PER_ITEM = 4
          const SHIPPING_DATE_COL = BASE_COLS + MAX_ITEMS * COLS_PER_ITEM
          const STATUS_COL = SHIPPING_DATE_COL + 1
          const NOTES_COL = STATUS_COL + 1

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

      case "Order_history":
        range = "Order_history!A2:GZ"
        processData = (data) => {
          const ordersMap: { [key: string]: any } = {}

          const MAX_ITEMS = 50
          const BASE_COLS = 5
          const COLS_PER_ITEM = 4
          const SHIPPING_DATE_COL = BASE_COLS + MAX_ITEMS * COLS_PER_ITEM
          const STATUS_COL = SHIPPING_DATE_COL + 1

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
                  status: row[STATUS_COL] || "処理中",
                  shippingDate: row[SHIPPING_DATE_COL] || null,
                  sourceSheet: "Order_history",
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

      case "store_info":
      case "store_info!A2:G":
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
        range = sheet
        processData = (data) => data
        break
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range,
    })

    const values = response.data.values || []
    const processedData = processData(values)

    setCachedData(cacheKey, processedData)

    return res.status(200).json(processedData)
  } catch (error) {
    console.error("Error fetching sheet data:", error)

    if (error instanceof Error && error.message.includes("Quota exceeded")) {
      return res.status(429).json({
        error: "API quota exceeded. Please try again in a few minutes.",
      })
    }

    return res.status(500).json({
      error: "Failed to fetch sheet data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}