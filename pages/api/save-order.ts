import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"
import crypto from "crypto"
import nodemailer from "nodemailer"

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

// メール送信用のトランスポーターを設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

// 注文確認メールを送信する関数
async function sendOrderConfirmationEmail(
  to: string,
  subject: string,
  orderNumber: string,
  storeName: string,
  items: any[],
  totalAmount: number,
) {
  try {
    // 商品リストのHTMLを生成
    const itemsHtml = items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.item_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.selectedSize || "-"}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.selectedColor || "-"}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        </tr>
      `,
      )
      .join("")

    // 合計金額の表示
    const formattedTotal = new Intl.NumberFormat("ja-JP").format(totalAmount)

    // メール本文のHTML
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(to right, #3b82f6, #0ea5e9); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SPLASH'N'GO!</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">ご注文ありがとうございます</p>
      </div>
      
      <div style="padding: 25px; background-color: #f0f9ff; border-left: 1px solid #e0f2fe; border-right: 1px solid #e0f2fe;">
        <p style="color: #334155;">${storeName} 様</p>
        <p style="color: #334155;">この度はご注文いただき、誠にありがとうございます。<br>以下の内容でご注文を承りました。</p>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #bae6fd;">
          <h2 style="margin-top: 0; color: #0284c7; font-size: 18px; border-bottom: 2px solid #e0f2fe; padding-bottom: 10px;">ご注文情報</h2>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注番号:</strong> ${orderNumber}</p>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注日時:</strong> ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
          
          <h3 style="margin: 20px 0 10px; color: #0284c7; font-size: 16px;">ご注文商品</h3>
          <table style="width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 10px; text-align: left; color: #0284c7; font-weight: 600;">商品名</th>
                <th style="padding: 10px; text-align: center; color: #0284c7; font-weight: 600;">サイズ</th>
                <th style="padding: 10px; text-align: center; color: #0284c7; font-weight: 600;">カラー</th>
                <th style="padding: 10px; text-align: center; color: #0284c7; font-weight: 600;">数量</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #e0f2fe;">
            <p style="color: #334155; font-size: 16px;"><strong style="color: #0284c7;">合計金額（税込）:</strong> ¥${formattedTotal}</p>
          </div>
        </div>
        
        <p style="color: #334155; background-color: #dbeafe; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6;">
          商品の準備が整い次第、出荷のご連絡をさせていただきます。<br>
          ご不明な点がございましたら、お気軽にお問い合わせください。
        </p>
      </div>
      
      <div style="background-color: #0c4a6e; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 5px;">© 2025 SPLASH'N'GO! All rights reserved.</p>
        <p style="margin: 0;">お問い合わせ: <a href="mailto:info@splashbrothers.co.jp" style="color: #7dd3fc;">info@splashbrothers.co.jp</a> | 050-1748-0947</p>
      </div>
    </div>
    `

    // メール送信
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
      to,
      subject,
      html,
    })

    console.log("Email sent successfully:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("メール送信エラー:", error)
    throw error
  }
}

// パートナー向けメールを送信する関数
async function sendPartnerEmail(to: string, subject: string, orderNumber: string, storeName: string, items: any[]) {
  try {
    console.log("Partner email request received:", {
      to,
      subject,
      orderNumber,
      storeName,
      itemCount: items?.length || 0,
    })

    if (!to || !subject || !orderNumber || !storeName || !items) {
      console.error("Missing parameters:", { to, subject, orderNumber, storeName, hasItems: !!items })
      throw new Error("必要なパラメータが不足しています")
    }

    // 商品リストのHTMLを生成
    const itemsHtml = items
      .map(
        (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.item_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.item_category}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.selectedSize || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.selectedColor || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>
  `,
      )
      .join("")

    // メール本文のHTML
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(to right, #3b82f6, #0ea5e9); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SPLASH'N'GO!</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">パートナー様向け発注通知</p>
      </div>
      
      <div style="padding: 25px; background-color: #f0f9ff; border-left: 1px solid #e0f2fe; border-right: 1px solid #e0f2fe;">
        <p style="color: #334155; margin-bottom: 15px;">平素はお世話になっております。</p>
        <p style="color: #334155; margin-bottom: 20px;">以下の商品の発注がありましたのでお知らせいたします。</p>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #bae6fd;">
          <h2 style="margin-top: 0; color: #0284c7; font-size: 18px; border-bottom: 2px solid #e0f2fe; padding-bottom: 10px;">発注情報</h2>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注番号:</strong> ${orderNumber}</p>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注店舗:</strong> ${storeName}</p>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注日時:</strong> ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
          
          <h3 style="margin: 20px 0 10px; color: #0284c7; font-size: 16px;">発注商品</h3>
          <table style="width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 10px; text-align: left; color: #0284c7; font-weight: 600;">商品名</th>
                <th style="padding: 10px; text-align: left; color: #0284c7; font-weight: 600;">カテゴリ</th>
                <th style="padding: 10px; text-align: left; color: #0284c7; font-weight: 600;">サイズ</th>
                <th style="padding: 10px; text-align: left; color: #0284c7; font-weight: 600;">カラー</th>
                <th style="padding: 10px; text-align: center; color: #0284c7; font-weight: 600;">数量</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        
        <p style="color: #334155; background-color: #dbeafe; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6;">ご対応のほど、よろしくお願いいたします。</p>
      </div>
      
      <div style="background-color: #0c4a6e; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 5px;">© 2025 SPLASH'N'GO! All rights reserved.</p>
        <p style="margin: 0;">お問い合わせ: <a href="mailto:info@splashbrothers.co.jp" style="color: #7dd3fc;">info@splashbrothers.co.jp</a> | 050-1748-0947</p>
      </div>
    </div>
  `

    console.log("Sending partner email to:", to)

    // SMTPの設定をログ出力（パスワードは隠す）
    console.log("SMTP Configuration:", {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER ? "設定済み" : "未設定",
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
    })

    // メール送信
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
      to,
      subject,
      html,
    })

    console.log("Partner email sent successfully:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("パートナーメール送信エラー:", error)
    // エラーの詳細情報をログ出力
    if (error instanceof Error) {
      console.error("エラーメッセージ:", error.message)
      console.error("エラースタック:", error.stack)
    }
    throw error
  }
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

    // 商品情報とパートナー情報を取得
    const availableItems = await getAvailableItemsWithPartners()

    // 商品をシート別に振り分け
    const { hirockItems, regularItems } = categorizeItemsBySheet(processedItems, availableItems)

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

    // 発注確認メールを送信
    try {
      console.log("Preparing to send email to:", storeInfo.email)

      await sendOrderConfirmationEmail(
        storeInfo.email,
        `【SPLASH'N'GO!】発注確認 (${orderNumber})`,
        orderNumber,
        storeInfo.name,
        processedItems,
        totalAmount || 0,
      )

      console.log("メール送信成功")
    } catch (emailError) {
      console.error("メール送信エラー:", emailError)
      // メール送信エラーがあっても処理を続行
    }

    // 発注された商品の一覧をログ出力
    console.log(
      "発注された商品:",
      processedItems.map((item) => item.item_name),
    )

    // パートナー別に商品をグループ化
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

        // 部分一致で検索してみる
        console.log(
          "Available_itemsシートの商品名一覧:",
          availableItems.map((item) => item.name),
        )
      }
    })

    // デバッグログを追加
    console.log(
      "Partner groups:",
      Object.values(partnerGroups).map((group) => ({
        partnerName: group.name,
        partnerEmail: group.email,
        itemCount: group.items.length,
        items: group.items.map((item) => item.item_name),
      })),
    )

    // パートナーグループが空の場合は早期リターン
    if (Object.keys(partnerGroups).length === 0) {
      console.log("パートナー商品がないため、パートナーメールは送信しません")
      res.status(200).json({ success: true, orderNumber })
      return
    }

    // パートナーメールの送信部分を修正
    try {
      // パートナーメールの送信を同期的に処理
      for (const partnerInfo of Object.values(partnerGroups)) {
        try {
          console.log(`Sending email to partner: ${partnerInfo.name} (${partnerInfo.email})`)

          const result = await sendPartnerEmail(
            partnerInfo.email,
            `【SPLASH'N'GO!】発注通知 (${orderNumber})`,
            orderNumber,
            storeInfo.name,
            partnerInfo.items,
          )

          console.log(`${partnerInfo.name}へのメール送信成功:`, result)
        } catch (error) {
          console.error(`${partnerInfo.name}へのメール処理エラー:`, error)
          // エラーがあっても処理を続行
        }
      }

      // すべてのパートナーメール送信処理が完了した後にレスポンスを返す
      res.status(200).json({ success: true, orderNumber })
    } catch (error) {
      console.error("Error in partner email processing:", error)
      // パートナーメール処理でエラーが発生しても、注文自体は成功として扱う
      res.status(200).json({ success: true, orderNumber, partnerEmailError: true })
    }
  } catch (error) {
    console.error("Error saving order:", error)
    res.status(500).json({
      error: "Failed to save order data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
