import { google } from "googleapis"
import type { NextApiRequest, NextApiResponse } from "next"

// 修正箇所1: 型定義を追加
// 関数の前に以下の型定義を追加
type GroupedItem = {
  id: string
  category: string
  name: string
  colors: Set<string>
  sizes: Set<string>
  amounts: Set<number> // 数値型のSetとして定義
  prices: { [key: number]: string }
  pricesPerPiece: { [key: number]: string }
  leadTime: string
  partnerName: string
  partnerEmail: string
  imageUrl: string // 画像URLを追加
  color: string
}

// Google DriveのURLを直接表示可能な形式に変換する関数
function convertGoogleDriveUrl(url: string): string {
  try {
    if (!url) return ""

    // Google DriveのURLかどうかを確認（view形式）
    if (url.includes("drive.google.com/file/d/")) {
      // ファイルIDを抽出
      const fileIdMatch = url.match(/\/d\/([^/]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        // 直接表示可能なURLに変換
        console.log(`Converting Google Drive URL for file ID: ${fileId}`)
        return `https://drive.google.com/uc?export=view&id=${fileId}`
      }
    }

    return url
  } catch (error) {
    console.error("Error converting Google Drive URL:", error)
    return ""
  }
}

async function getAuthToken() {
  // 環境変数チェックを追加し、エラーメッセージを改善
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.warn("Google認証情報が設定されていません。テストモードで実行します。")
    return null
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
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { sheet } = req.query

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
      const auth = await getAuthToken()

      // 認証情報が取得できない場合はテストデータを返す
      if (!auth) {
        console.warn("認証情報が取得できませんでした。テストデータを返します。")
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

      const sheets = google.sheets({
        version: "v4",
        auth,
      })

      // Available_itemsシートの範囲を修正してK列まで含める
      let range = ""
      if (sheet === "Available_items") {
        range = "Available_items!A2:K" // K列まで取得
        console.log("Fetching Available_items with range:", range)
      } else if (sheet === "Order_history") {
        range = "Order_history!A2:AV" // 注文履歴は広い範囲を取得
      } else if (sheet === "hirock_item_history") {
        range = "hirock_item_history!A2:AV" // ハイロックの注文履歴も同じ範囲を取得
      } else {
        range = `${sheet}`
      }

      console.log(`Fetching data from sheet: ${range}`)

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: range,
      })

      if (!response.data.values) {
        console.warn(`No data found in sheet: ${range}`)

        // store_info シートの場合はテストデータを返す
        if (sheet === "store_info!A2:G") {
          return res.status(200).json([
            ["store1", "テスト店舗1", "100-0001", "東京都渋谷区", "03-1234-5678", "test1@example.com", "password1"],
            ["store2", "テスト店舗2", "530-0001", "大阪府大阪市", "06-1234-5678", "test2@example.com", "password2"],
          ])
        }

        return res.status(404).json({ error: "No data found", sheet: sheet })
      }

      if (sheet === "Available_items") {
        // 商品データをより効率的に処理
        const processedItems = processAvailableItems(response.data.values)

        // デバッグ用：最初の数件の商品データを確認
        console.log(
          "Processed items sample (first 3):",
          processedItems.slice(0, 3).map((item) => ({
            name: item.name,
            imageUrl: item.imageUrl,
          })),
        )

        res.status(200).json(processedItems)
      } else if (sheet === "Order_history" || sheet === "hirock_item_history") {
        // 注文履歴データを処理
        const processedOrders = processOrderHistory(response.data.values)
        res.status(200).json(processedOrders)
      } else {
        res.status(200).json(response.data.values)
      }
    } catch (error) {
      console.error("Error details:", error)

      // エラーメッセージをより詳細に
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const errorStack = error instanceof Error ? error.stack : ""

      // テストデータを返す（シートに応じて）
      if (sheet === "store_info!A2:G") {
        console.warn("店舗情報の取得に失敗しました。テストデータを返します。")
        return res.status(200).json([
          ["store1", "テスト店舗1", "100-0001", "東京都渋谷区", "03-1234-5678", "test1@example.com", "password1"],
          ["store2", "テスト店舗2", "530-0001", "大阪府大阪市", "06-1234-5678", "test2@example.com", "password2"],
        ])
      }

      res.status(500).json({
        error: "Error fetching data from Google Sheets",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
        sheet: sheet,
      })
    }
  } else {
    res.setHeader("Allow", ["GET"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

// 商品データ処理を別関数に分離して最適化
function processAvailableItems(rows: any[][]) {
  console.log(`Processing ${rows.length} rows from Available_items sheet`)

  const groupedItems = new Map<string, GroupedItem>()

  // スプレッドシートの各行を処理
  rows.forEach((row, index) => {
    // 行のデータを確認
    if (index < 5) {
      console.log(`Row ${index} data:`, row)
    }

    const category = row[0] || "" // A列: カテゴリ
    const name = row[2] || "" // C列: 商品名（修正：B列ではなくC列から取得）
    const color = row[3] || ""
    const size = row[4] || ""
    const amount = row[5] || ""
    const price = row[6] || ""
    const pricePerPiece = row[7] || ""
    const leadTime = row[8] || ""
    const partnerName = row[8] || "" // I列: パートナー名
    const partnerEmail = row[9] || "" // J列: パートナーメールアドレス
    const imageUrl = row[10] || "" // K列: 画像URL

    // K列（imageUrl）の値を確認
    if (index < 5) {
      console.log(`Row ${index} imageUrl (K column):`, imageUrl)
    }

    // ********* 重要な変更: 商品名とカラーをキーとして使用 *********
    // 商品名と色の組み合わせでキーを作成
    const key = `${name}-${color}`
    const id = Math.random().toString(36).substring(2, 9)

    if (!groupedItems.has(key)) {
      // 新しい商品の場合、初期データを設定
      groupedItems.set(key, {
        id: id || Math.random().toString(36).substring(2, 9),
        category: category || "",
        name: name || "",
        colors: new Set<string>(),
        sizes: new Set<string>(),
        amounts: new Set<number>(),
        prices: {},
        pricesPerPiece: {},
        leadTime: leadTime || "2週間",
        partnerName: partnerName || "",
        partnerEmail: partnerEmail || "", // パートナーのメールアドレス
        imageUrl: imageUrl ? convertGoogleDriveUrl(imageUrl) : "", // 画像URLを変換して追加
        color: color || "", // 色情報を追加
      })
    }

    // 修正箇所2: 必ず存在することを保証
    const item = groupedItems.get(key)! // 非nullアサーション演算子を使用

    // 画像URLを更新（存在する場合のみ）
    if (imageUrl && !item.imageUrl) {
      item.imageUrl = convertGoogleDriveUrl(imageUrl)
    }

    // カラーとサイズを追加（存在する場合）
    if (color) item.colors.add(color)
    if (size) item.sizes.add(size)

    // 数量を追加（販促グッズの場合は特に重要）
    if (amount) {
      // 数値に変換して保存
      const amountValue = amount.toString().replace(/[^0-9]/g, "")
      if (amountValue) {
        const numAmount = Number.parseInt(amountValue, 10)
        item.amounts.add(numAmount)

        // 対応する価格も保存
        if (price) {
          item.prices[numAmount] = price
        }

        // 1個あたりの価格も保存
        if (pricePerPiece) {
          item.pricesPerPiece[numAmount] = pricePerPiece
        }
      }
    }
  })

  // グループ化したデータを配列に変換
  const result = Array.from(groupedItems.values()).map((item) => {
    // 数量を昇順にソート
    const sortedAmounts = Array.from(item.amounts).sort((a, b) => a - b)

    // 対応する価格の配列を作成
    const sortedPrices = sortedAmounts.map((amount) => item.prices[amount] || "0")

    // 対応する1個あたりの価格の配列を作成
    const sortedPricesPerPiece = sortedAmounts.map((amount) => item.pricesPerPiece[amount] || "0")

    return {
      id: item.id,
      category: item.category,
      name: item.name,
      colors: Array.from(item.colors),
      sizes: Array.from(item.sizes),
      amounts: sortedAmounts,
      prices: sortedPrices,
      pricesPerPiece: sortedPricesPerPiece,
      leadTime: item.leadTime,
      partnerName: item.partnerName,
      partnerEmail: item.partnerEmail, // パートナーのメールアドレスを返す
      imageUrl: item.imageUrl, // 画像URLを追加
      color: item.color, // 色情報を返す
    }
  })

  // 画像URLを持つ商品の数をカウント
  const itemsWithImages = result.filter((item) => item.imageUrl && item.imageUrl.trim() !== "").length
  console.log(`Found ${itemsWithImages} items with image URLs out of ${result.length} total items`)

  return result
}

// 特定の販促グッズリストを定義
const specialPromotionalItems = [
  "ポイントカード",
  "サブスクメンバーズカード",
  "サブスクフライヤー",
  "フリーチケット",
  "クーポン券",
  "名刺",
  "のぼり",
  "お年賀(マイクロファイバークロス)",
]

// 特定のアイテムかどうかを判定する関数
const isSpecialItem = (itemName: string): boolean => {
  return specialPromotionalItems.some((name) => itemName.includes(name))
}

// 注文履歴データを処理する関数
function processOrderHistory(rows: any[][]) {
  // 修正箇所3: 明示的な型定義を追加
  type OrderItem = {
    name: string
    size: string
    color: string
    quantity: string
  }

  return rows.map((row, index) => {
    // 基本情報を抽出
    const orderNumber = row[0] || `ORD-${(index + 1).toString().padStart(5, "0")}`
    const orderDate = row[1] || ""
    const orderTime = row[2] || ""
    const storeName = row[3] || ""
    const email = row[4] || ""

    // 商品情報を抽出
    const items: OrderItem[] = []
    for (let i = 5; i < Math.min(row.length, 33); i += 4) {
      // 商品名が存在する場合のみ追加
      if (row[i]) {
        const itemName = row[i] || ""
        const itemSize = row[i + 1] || ""
        const itemColor = row[i + 2] || ""
        const itemQuantity = row[i + 3] || "1"

        items.push({
          name: itemName,
          size: itemSize,
          color: itemColor,
          quantity: itemQuantity,
        })
      }
    }

    // 出荷日とステータスを取得
    const shippingDate = row[45] || null // AT列（46番目、0から始まるので45）
    const status = row[46] || "処理中" // AU列（47番目、0から始まるので46）

    return {
      orderNumber,
      orderDate,
      orderTime,
      storeName,
      email,
      items,
      status,
      shippingDate,
    }
  })
}
