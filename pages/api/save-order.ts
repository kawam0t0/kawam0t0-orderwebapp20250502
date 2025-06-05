import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"
import crypto from "crypto"

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

// 株式会社アピカが取り扱う商品リストを定義
const APICA_PRODUCTS = ["スプシャン", "スプワックス", "スプコート", "セラミック", "マイクロファイバー", "スプタイヤ"]

// 型定義
type Product = {
  id: string
  item_category: string
  item_name: string
  selectedSize?: string
  selectedColor?: string
  quantity: number
  price?: string | string[]
  item_price?: string | string[]
  partnerName?: string
  selectedQuantity?: number
}

type StoreInfo = {
  name: string
  email: string
  id: string
}

type PartnerInfo = {
  name: string
  email: string
  items: Product[]
}

type AvailableItem = {
  category: string
  name: string
  partnerName: string
  partnerEmail: string
}

// スプレッドシートに保存する前の数量処理を修正る関数
const processOrderItems = (items) => {
  return items.map((item) => {
    // のぼりの商品の場合は、数量を「1」に設定
    if (item.item_name.includes("のぼり(6枚1セット)") || item.item_name.includes("のぼり(10枚1セット)")) {
      return {
        ...item,
        quantity: 1, // のぼりの商品は常に「1セット」として保存
      }
    }

    // 特定の販促グッズの場合は、selectedQuantity を quantity として使用
    if (specialPromotionalItems.some((name) => item.item_name.includes(name))) {
      // selectedQuantity が存在する場合はそれを使用、存在しない場合は元の quantity を使用
      const updatedQuantity = item.selectedQuantity ? Number(item.selectedQuantity) : item.quantity
      return {
        ...item,
        quantity: updatedQuantity, // 選択された数量を quantity として設定
      }
    }

    // その他の商品は従来通りの処理
    return item
  })
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

// 発注番号生成
function generateOrderNumber(): string {
  const timestamp = Date.now().toString()
  const hash = crypto.createHash("md5").update(timestamp).digest("hex")
  const numericHash = Number.parseInt(hash.substring(0, 6), 16) % 100000
  return "ORD-" + numericHash.toString().padStart(5, "0")
}

// 商品情報とパートナー情報を取得する関数
async function getAvailableItemsWithPartners(): Promise<AvailableItem[]> {
  try {
    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // Available_itemsシートからデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Available_items!A2:J", // J列までのデータを取得
    })

    if (!response.data.values) {
      console.log("Available_itemsシートにデータがありません")
      return []
    }

    console.log(`Available_itemsシートから ${response.data.values.length} 行のデータを取得しました`)

    // 商品データを処理
    const items = response.data.values.map((row) => {
      const category = row[0] || "" // A列: カテゴリ
      const name = row[2] || "" // C列: 商品名（修正：B列ではなくC列から取得）
      const partnerName = row[8] || "" // I列: パートナー名
      const partnerEmail = row[9] || "" // J列: パートナーメールアドレス

      // デバッグ用に各行のデータをログ出力
      if (partnerName && partnerEmail) {
        console.log(`商品データ: カテゴリ=${category}, 名前=${name}, パートナー=${partnerName}, メール=${partnerEmail}`)
      }

      return {
        category,
        name,
        partnerName,
        partnerEmail,
      }
    })

    // パートナー情報があるアイテムの数をカウント
    const itemsWithPartners = items.filter((item) => item.partnerName && item.partnerEmail)
    console.log(`パートナー情報がある商品: ${itemsWithPartners.length}/${items.length}`)

    return items
  } catch (error) {
    console.error("Error fetching available items:", error)
    return []
  }
}

// 商品名が一致するかどうかを判定する関数
function matchProductName(orderItemName: string, availableItemName: string): boolean {
  // 両方の商品名を小文字に変換して比較
  const normalizedOrderItem = orderItemName.toLowerCase().trim()
  const normalizedAvailableItem = availableItemName.toLowerCase().trim()

  // 完全一致の場合
  if (normalizedOrderItem === normalizedAvailableItem) {
    return true
  }

  // 部分一致の場合（どちらかがもう一方を含む）
  if (normalizedOrderItem.includes(normalizedAvailableItem) || normalizedAvailableItem.includes(normalizedOrderItem)) {
    return true
  }

  // 単語単位での一致チェック
  const orderWords = normalizedOrderItem.split(/\s+/)
  const availableWords = normalizedAvailableItem.split(/\s+/)

  // 共通する単語が多い場合に一致と判定
  const commonWords = orderWords.filter((word) => availableWords.includes(word))
  if (commonWords.length > 0 && commonWords.length >= Math.min(orderWords.length, availableWords.length) / 2) {
    return true
  }

  return false
}

// パートナー名の定数
const HIROCK_PARTNER_NAME = "ハイロックデザインオフィス"

// 商品をシート別に振り分ける関数
function categorizeItemsBySheet(
  items: Product[],
  availableItems: AvailableItem[],
): {
  hirockItems: Product[]
  regularItems: Product[]
} {
  const hirockItems: Product[] = []
  const regularItems: Product[] = []

  items.forEach((item) => {
    // アピカ商品かどうかをチェック
    const isApicaProduct = APICA_PRODUCTS.some((productName) => item.item_name.includes(productName))

    if (isApicaProduct) {
      // アピカ商品は常にregularItemsに追加
      regularItems.push(item)
      return
    }

    // 商品名に一致する商品情報を検索
    const matchingItems = availableItems.filter((avItem) => matchProductName(item.item_name, avItem.name))

    if (matchingItems.length > 0) {
      // 最も一致度の高い商品を選択（ここでは単純に最初のものを使用）
      const matchingItem = matchingItems[0]

      // パートナー名がハイロックデザインオフィスの場合
      if (matchingItem.partnerName === HIROCK_PARTNER_NAME) {
        hirockItems.push(item)
      } else {
        regularItems.push(item)
      }
    } else {
      // マッチする商品が見つからない場合は通常のアイテムとして扱う
      regularItems.push(item)
    }
  })

  return { hirockItems, regularItems }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { items, storeInfo, totalAmount } = req.body as {
      items: Product[]
      storeInfo: StoreInfo
      totalAmount: number
    }

    if (!items || !storeInfo) {
      return res.status(400).json({ error: "Missing required data" })
    }

    console.log("=== 発注処理開始 ===")
    console.log("発注商品数:", items.length)
    console.log("店舗情報:", storeInfo.name)
    console.log("合計金額:", totalAmount)

    // 商品情報を処理
    const processedItems = processOrderItems(items)

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // 現在の日時を取得（日本時間で）
    const now = new Date()
    // 日本時間に変換
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
    const orderNumber = generateOrderNumber()
    console.log("発注番号:", orderNumber)

    // 商品情報とパートナー情報を取得
    const availableItems = await getAvailableItemsWithPartners()

    // 商品をシート別に振り分け
    const { hirockItems, regularItems } = categorizeItemsBySheet(processedItems, availableItems)

    console.log("通常アイテム数:", regularItems.length)
    console.log("ハイロックアイテム数:", hirockItems.length)

    // 通常のアイテムがある場合は Order_history シートに追加
    if (regularItems.length > 0) {
      // スプレッドシートに追加するデータを準備
      const regularRowData = new Array(47).fill("") // 十分な長さの配列を初期化（AT列とAU列を含む）

      // 基本情報を設定
      regularRowData[0] = orderNumber // A列: 発注番号
      regularRowData[1] = dateStr // B列: 発注日
      regularRowData[2] = timeStr // C列: 発注時間
      regularRowData[3] = storeInfo.name // D列: 店舗名
      regularRowData[4] = storeInfo.email // E列: メールアドレス

      // 商品情報を追加 (F列以降)
      regularItems.forEach((item, index) => {
        const baseIndex = 5 + index * 4 // 各商品は4列を使用
        if (baseIndex < regularRowData.length - 3) {
          regularRowData[baseIndex] = item.item_name
          regularRowData[baseIndex + 1] = item.selectedSize || ""
          regularRowData[baseIndex + 2] = item.selectedColor || ""
          regularRowData[baseIndex + 3] = item.quantity.toString() // 処理済みの数量を使用
        }
      })

      // Order_history シートに行を追加
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SHEET_ID,
        range: "Order_history!A1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [regularRowData],
        },
      })

      console.log("通常アイテムを Order_history シートに追加しました")
    }

    // ハイロックデザインオフィスのアイテムがある場合は hirock_item_history シートに追加
    if (hirockItems.length > 0) {
      // スプレッドシートに追加するデータを準備
      const hirockRowData = new Array(47).fill("") // 十分な長さの配列を初期化

      // 基本情報を設定
      hirockRowData[0] = orderNumber // A列: 発注番号
      hirockRowData[1] = dateStr // B列: 発注日
      hirockRowData[2] = timeStr // C列: 発注時間
      hirockRowData[3] = storeInfo.name // D列: 店舗名
      hirockRowData[4] = storeInfo.email // E列: メールアドレス

      // 商品情報を追加 (F列以降)
      hirockItems.forEach((item, index) => {
        const baseIndex = 5 + index * 4 // 各商品は4列を使用
        if (baseIndex < hirockRowData.length - 3) {
          hirockRowData[baseIndex] = item.item_name
          hirockRowData[baseIndex + 1] = item.selectedSize || ""
          hirockRowData[baseIndex + 2] = item.selectedColor || ""
          hirockRowData[baseIndex + 3] = item.quantity.toString() // 処理済みの数量を使用
        }
      })

      // hirock_item_history シートに行を追加
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SHEET_ID,
        range: "hirock_item_history!A1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [hirockRowData],
        },
      })

      console.log("ハイロックデザインオフィスのアイテムを hirock_item_history シートに追加しました")
    }

    console.log("=== スプレッドシート保存完了 ===")

    // メール送信処理を開始
    console.log("=== メール送信処理開始 ===")

    // 1. 発注確認メールを送信（ユーザー向け）
    try {
      console.log("発注確認メールを送信中:", storeInfo.email)

      const emailResponse = await fetch(
        `${req.headers.origin || "https://office-supplies-app.vercel.app"}/api/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: storeInfo.email,
            subject: `【SPLASH'N'GO!】発注確認 (${orderNumber})`,
            orderNumber,
            storeName: storeInfo.name,
            items: processedItems,
            totalAmount: totalAmount || 0,
          }),
        },
      )

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.error("発注確認メール送信に失敗しました:", errorText)
      } else {
        const emailResult = await emailResponse.json()
        console.log("発注確認メール送信成功:", emailResult)
      }
    } catch (emailError) {
      console.error("発注確認メール送信エラー:", emailError)
    }

    // 2. パートナー別に商品をグループ化してパートナーメールを送信
    console.log("パートナーメール送信処理開始")

    const partnerGroups: { [key: string]: PartnerInfo } = {}

    // 各商品のパートナー情報を設定
    processedItems.forEach((item) => {
      console.log(`商品 ${item.item_name} のパートナー情報を検索中...`)

      // 商品名に一致する商品情報を検索
      const matchingItems = availableItems.filter((avItem) => matchProductName(item.item_name, avItem.name))

      if (matchingItems.length > 0) {
        // 最も一致度の高い商品を選択（ここでは単純に最初のものを使用）
        const matchingItem = matchingItems[0]

        if (matchingItem.partnerName && matchingItem.partnerEmail) {
          const partnerName = matchingItem.partnerName
          const partnerEmail = matchingItem.partnerEmail

          console.log(`商品 ${item.item_name} のパートナー: ${partnerName}, メール: ${partnerEmail}`)

          // パートナーグループが存在しない場合は作成
          if (!partnerGroups[partnerName]) {
            partnerGroups[partnerName] = {
              name: partnerName,
              email: partnerEmail,
              items: [],
            }
          }

          // 商品をパートナーグループに追加
          partnerGroups[partnerName].items.push(item)
        } else {
          console.log(
            `商品 ${item.item_name} のパートナー情報が不完全です: 名前=${matchingItem.partnerName}, メール=${matchingItem.partnerEmail}`,
          )
        }
      } else {
        console.log(`商品 ${item.item_name} に一致する商品情報が見つかりません`)
      }
    })

    // パートナーメールの送信
    const partnerEmailPromises = Object.values(partnerGroups).map(async (partnerInfo) => {
      try {
        console.log(`パートナーメール送信中: ${partnerInfo.name} (${partnerInfo.email})`)

        const partnerEmailResponse = await fetch(
          `${req.headers.origin || "https://office-supplies-app.vercel.app"}/api/send-partner-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: partnerInfo.email,
              subject: `【SPLASH'N'GO!】発注通知 (${orderNumber})`,
              orderNumber,
              storeName: storeInfo.name,
              items: partnerInfo.items,
            }),
          },
        )

        if (!partnerEmailResponse.ok) {
          const errorText = await partnerEmailResponse.text()
          console.error(`${partnerInfo.name}へのメール送信に失敗しました:`, errorText)
        } else {
          const partnerResult = await partnerEmailResponse.json()
          console.log(`${partnerInfo.name}へのメール送信成功:`, partnerResult)
        }
      } catch (error) {
        console.error(`${partnerInfo.name}へのメール処理エラー:`, error)
      }
    })

    // パートナーメールの送信を並行して実行
    if (partnerEmailPromises.length > 0) {
      console.log(`${partnerEmailPromises.length}件のパートナーメールを送信中...`)
      await Promise.allSettled(partnerEmailPromises)
      console.log("パートナーメール送信処理完了")
    } else {
      console.log("パートナー商品がないため、パートナーメールは送信しません")
    }

    console.log("=== メール送信処理完了 ===")
    console.log("=== 発注処理完了 ===")

    // 成功レスポンスを返す
    res.status(200).json({ success: true, orderNumber })
  } catch (error) {
    console.error("Error saving order:", error)
    res.status(500).json({
      error: "Failed to save order data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
