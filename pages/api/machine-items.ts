import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// 部品アイテムの型定義
type MachineItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  imageUrl?: string
}

// Google DriveのURLを直接表示可能な形式に変換する関数（改善版）
function convertGoogleDriveUrl(url: string): string {
  try {
    if (!url || url.trim() === "") {
      return ""
    }

    console.log(`Converting URL: ${url}`)

    // Google DriveのURLかどうかを確認
    if (url.includes("drive.google.com/file/d/")) {
      const fileIdMatch = url.match(/\/d\/([^/]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        console.log(`Extracted file ID: ${fileId}`)

        // 複数の形式を試す - より確実な方法
        const convertedUrl = `https://lh3.googleusercontent.com/d/${fileId}`
        console.log(`Converted to: ${convertedUrl}`)
        return convertedUrl
      }
    }

    // 既に適切な形式の場合はそのまま返す
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

    console.log("Fetching data from machine_item sheet...")

    // machine_itemシートからデータを取得する範囲をF列まで拡張
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "machine_item!A2:F", // A列からF列まで取得（F列に画像URL）
    })

    if (!response.data.values) {
      console.log("machine_itemシートにデータがありません")
      return res.status(200).json([])
    }

    console.log(`machine_itemシートから ${response.data.values.length} 行のデータを取得しました`)

    // データを整形する部分で画像URLを追加・変換
    const machineItems: MachineItem[] = response.data.values.map((row, index) => {
      const rawImageUrl = row[5] || "" // F列: 画像URL
      const convertedImageUrl = rawImageUrl ? convertGoogleDriveUrl(rawImageUrl) : ""

      console.log(`Row ${index + 1} - ${row[3] || "Unknown"}:`, {
        rawImageUrl,
        convertedImageUrl,
      })

      return {
        id: `machine-item-${index + 1}`,
        storeName: row[1] || "", // B列: 店舗名
        category: row[2] || "", // C列: カテゴリー
        itemName: row[3] || "", // D列: アイテム名
        imageUrl: convertedImageUrl, // 変換済み画像URL
      }
    })

    // 空のアイテム名、カテゴリー、店舗名を除外
    const filteredItems = machineItems.filter(
      (item) => item.itemName.trim() !== "" && item.category.trim() !== "" && item.storeName.trim() !== "",
    )

    console.log(`フィルタリング後: ${filteredItems.length} 件の部品アイテム`)

    // 画像URLを持つアイテムの数をログ出力
    const itemsWithImages = filteredItems.filter((item) => item.imageUrl && item.imageUrl.trim() !== "").length
    console.log(`画像URLを持つアイテム: ${itemsWithImages} / ${filteredItems.length}`)

    // デバッグ用：最初の数件の詳細ログ
    console.log("Sample items with image URLs:")
    filteredItems.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.itemName}: ${item.imageUrl || "No image"}`)
    })

    res.status(200).json(filteredItems)
  } catch (error) {
    console.error("Error fetching machine items:", error)
    res.status(500).json({
      error: "Failed to fetch machine items",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
