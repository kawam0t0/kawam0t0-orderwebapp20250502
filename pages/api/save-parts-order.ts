import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"
import crypto from "crypto"

// 型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
}

type StoreInfo = {
  name: string
  email: string
  id: string
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

// 発注番号生成
function generatePartsOrderNumber(): string {
  const timestamp = Date.now().toString()
  const hash = crypto.createHash("md5").update(timestamp).digest("hex")
  const numericHash = Number.parseInt(hash.substring(0, 6), 16) % 100000
  return "PO-" + numericHash.toString().padStart(5, "0")
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { items, storeInfo, shippingMethod } = req.body as {
      items: PartsCartItem[]
      storeInfo: StoreInfo
      shippingMethod: string
    }

    if (!items || !storeInfo) {
      return res.status(400).json({ error: "Missing required data" })
    }

    console.log("=== 部品発注処理開始 ===")
    console.log("発注部品数:", items.length)
    console.log("発注者:", storeInfo.name)
    console.log("配送方法:", shippingMethod)

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // 現在の日時を取得（日本時間で）
    const now = new Date()
    const jstNow = new Date(now.getTime())
    const dateStr = jstNow.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Tokyo",
    })
    const timeStr = jstNow.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    })

    // 発注番号を生成
    const orderNumber = generatePartsOrderNumber()
    console.log("発注番号:", orderNumber)

    // 各部品について machine_item_history シートに行を追加
    for (const item of items) {
      const rowData = [
        orderNumber, // A列: 発注番号
        dateStr, // B列: 発注日
        timeStr, // C列: 発注時間
        storeInfo.name, // D列: 発注者名
        storeInfo.email, // E列: メールアドレス
        item.storeName, // F列: 店舗名
        item.category, // G列: カテゴリー
        item.itemName, // H列: 部品名
        item.quantity.toString(), // I列: 数量
        shippingMethod, // J列: 配送方法
      ]

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SHEET_ID,
        range: "machine_item_history!A1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      })
    }

    console.log("=== 部品発注データ保存完了 ===")

    // 成功レスポンスを返す（発注書生成用のデータも含める）
    res.status(200).json({
      success: true,
      orderNumber,
      orderData: {
        items,
        storeInfo,
        shippingMethod,
      },
    })
  } catch (error) {
    console.error("Error saving parts order:", error)
    res.status(500).json({
      error: "Failed to save parts order data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
