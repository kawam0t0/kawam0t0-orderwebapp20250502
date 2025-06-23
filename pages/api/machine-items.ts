import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// 部品アイテムの型定義
type MachineItem = {
  id: string
  storeName: string
  category: string
  itemName: string
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
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      })
    }

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
    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // machine_itemシートからデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "machine_item!A2:D", // A列からD列まで取得
    })

    if (!response.data.values) {
      console.log("machine_itemシートにデータがありません")
      return res.status(200).json([])
    }

    console.log(`machine_itemシートから ${response.data.values.length} 行のデータを取得しました`)

    // データを整形
    const machineItems: MachineItem[] = response.data.values.map((row, index) => ({
      id: `machine-item-${index + 1}`,
      storeName: row[1] || "", // B列: 店舗名
      category: row[2] || "", // C列: カテゴリー
      itemName: row[3] || "", // D列: アイテム名
    }))

    // 空のアイテム名、カテゴリー、店舗名を除外
    const filteredItems = machineItems.filter(
      (item) => item.itemName.trim() !== "" && item.category.trim() !== "" && item.storeName.trim() !== "",
    )

    console.log(`フィルタリング後: ${filteredItems.length} 件の部品アイテム`)

    res.status(200).json(filteredItems)
  } catch (error) {
    console.error("Error fetching machine items:", error)
    res.status(500).json({
      error: "Failed to fetch machine items",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
