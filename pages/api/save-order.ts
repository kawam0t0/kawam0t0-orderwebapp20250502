import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

const SPREADSHEET_ID = process.env.SHEET_ID

async function getAuthClient() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  }
  throw new Error("Google認証情報が設定されていません。")
}

// 保護対応の書き込み関数
async function safeSheetWrite(
  sheetNames: string[],
  values: any[][],
  retries = 3,
): Promise<{ success: boolean; sheetUsed?: string; error?: string }> {
  const auth = await getAuthClient()
  const sheets = google.sheets({ version: "v4", auth })
  for (const sheetName of sheetNames) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempting to write to sheet: ${sheetName} (attempt ${attempt}/${retries})`)

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            values: values,
          },
        })

        console.log(`Successfully wrote to sheet: ${sheetName}`)
        return { success: true, sheetUsed: sheetName }
      } catch (error: any) {
        console.error(`Error writing to ${sheetName} (attempt ${attempt}):`, error.message)

        // 保護エラーの場合は次のシートを試行
        if (error.message?.includes("protected cell") || error.message?.includes("protected")) {
          console.log(`Sheet ${sheetName} is protected, trying next sheet...`)
          break // 次のシート名を試行
        }

        // その他のエラーの場合はリトライ
        if (attempt === retries) {
          console.error(`Failed to write to ${sheetName} after ${retries} attempts`)
        } else {
          console.log(`Retrying write to ${sheetName} in 1 second...`)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }
  }

  return { success: false, error: "All sheet write attempts failed" }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { items, storeInfo, shippingMethod, totalAmount } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid items data" })
    }

    if (!storeInfo || !storeInfo.name || !storeInfo.email) {
      return res.status(400).json({ error: "Invalid store information" })
    }

    console.log("Processing order for store:", storeInfo.name)
    console.log("Number of items:", items.length)

    // 注文番号の生成
    const orderNumber = `ORD-${Math.floor(Math.random() * 100000)}`
    const currentDate = new Date()
    const dateStr = currentDate
      .toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "/")
    const timeStr = currentDate.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    console.log("Generated order number:", orderNumber)

    // 各商品を個別の行として保存
    const orderRows: any[][] = []
    const hirockRows: any[][] = []

    // 新しい列構造:
    // A-E: 基本情報（発注番号、日付、時間、店舗名、メール）
    // F(5)〜GW(204): アイテム情報 最大50アイテム × 4列（名前、サイズ、色、数量）
    // GX(205): shipping_date
    // GY(206): status
    // GZ(207): 備考

    const MAX_ITEMS = 50
    const BASE_COLS = 5
    const COLS_PER_ITEM = 4
    const SHIPPING_DATE_COL = BASE_COLS + MAX_ITEMS * COLS_PER_ITEM // 205 = GX
    const STATUS_COL = SHIPPING_DATE_COL + 1                        // 206 = GY
    const NOTES_COL = STATUS_COL + 1                                // 207 = GZ
    const TOTAL_COLS = NOTES_COL + 1                                // 208列

    // hirock_item_historyにはアパレル・販促グッズのみ保存（液剤は除外）
    const hirockTargetCategories = ["アパレル", "販促グッズ"]
    const hirockTargetItems = items.filter((item: any) => {
      const cat = (item.item_category || item.category || "").trim()
      return hirockTargetCategories.some((c) => cat.includes(c))
    })

    if (hirockTargetItems.length > 0) {
      const hirockRowData: string[] = new Array(TOTAL_COLS).fill("")

      hirockRowData[0] = orderNumber
      hirockRowData[1] = dateStr
      hirockRowData[2] = timeStr
      hirockRowData[3] = storeInfo.name
      hirockRowData[4] = storeInfo.email

      hirockTargetItems.forEach((item: any, index: number) => {
        if (index >= MAX_ITEMS) return
        const colBase = BASE_COLS + index * COLS_PER_ITEM
        hirockRowData[colBase]     = item.item_name || ""
        hirockRowData[colBase + 1] = item.selectedSize || ""
        hirockRowData[colBase + 2] = item.selectedColor || ""
        hirockRowData[colBase + 3] = String(item.quantity || 1)
      })

      hirockRowData[SHIPPING_DATE_COL] = "" // GX: shipping_date
      hirockRowData[STATUS_COL] = "処理中"  // GY: status
      hirockRowData[NOTES_COL] = ""         // GZ: 備考

      hirockRows.push(hirockRowData)
    }

    console.log(`hirock_item_history対象アイテム: ${hirockTargetItems.length}件（液剤除外済み）`)

    // Order_history用は従来通り各アイテムを1行ずつ
    items.forEach((item: any, index: number) => {
      console.log(`Processing item ${index + 1}:`, item.item_name)
      const orderRow = [
        orderNumber,
        dateStr,
        timeStr,
        storeInfo.name,
        storeInfo.email,
        item.item_name,
        item.selectedSize || "",
        item.selectedColor || "",
        item.quantity || 1,
        item.selectedQuantity || "",
        item.item_price || "",
        totalAmount || "",
        shippingMethod || "standard",
        "処理中",
        "", "", "",
        ...Array(30).fill(""),
      ]
      orderRows.push(orderRow)
    })

    // Order_historyシートに保存
    const orderSheetNames = ["Order_history"]
    const orderResult = await safeSheetWrite(orderSheetNames, orderRows)

    if (!orderResult.success) {
      console.error("Failed to save to Order_history:", orderResult.error)
    } else {
      console.log("Successfully saved to Order_history")
    }

    // hirock_item_historyシートに保存
    const hirockSheetNames = ["hirock_item_history"]
    const hirockResult = await safeSheetWrite(hirockSheetNames, hirockRows)

    if (!hirockResult.success) {
      console.error("Failed to save to hirock_item_history sheets:", hirockResult.error)
    } else {
      console.log("Successfully saved to hirock_item_history sheet:", hirockResult.sheetUsed)
    }

    // 少なくとも一つのシートに保存できた場合は成功とする
    if (orderResult.success || hirockResult.success) {
      console.log("Order saved successfully with order number:", orderNumber)

      // partner_infoシートからパートナー情報（B列=名前, C列=メール）を取得
      let partnerList: { name: string; email: string }[] = []
      try {
        const auth = await getAuthClient()
        const sheets = google.sheets({ version: "v4", auth })
        const partnerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "partner_info!B2:C",
        })
        if (partnerResponse.data.values) {
          partnerList = partnerResponse.data.values
            .filter((row: any[]) => row[0] && row[1])
            .map((row: any[]) => ({ name: row[0].trim(), email: row[1].trim() }))
        }
        console.log("Partner list from partner_info:", partnerList)
      } catch (partnerError) {
        console.warn("Failed to fetch partner info:", partnerError)
      }

      // カテゴリーごとにアイテムをグループ分け
      // アパレル・販促グッズ → ハイロックデザインオフィス
      // 液剤 → 株式会社アピカ
      const hirockCategories = ["アパレル", "販促グッズ"]
      const apicaCategories = ["液剤"]

      const hirockItems = items.filter((item: any) => {
        const cat = (item.item_category || item.category || "").trim()
        return hirockCategories.some((c) => cat.includes(c))
      })
      const apicaItems = items.filter((item: any) => {
        const cat = (item.item_category || item.category || "").trim()
        return apicaCategories.some((c) => cat.includes(c))
      })
      const otherItems = items.filter((item: any) => {
        const cat = (item.item_category || item.category || "").trim()
        return !hirockCategories.some((c) => cat.includes(c)) && !apicaCategories.some((c) => cat.includes(c))
      })

      console.log("Hirock items:", hirockItems.length, "Apica items:", apicaItems.length, "Other items:", otherItems.length)

      const hirockPartner = partnerList.find((p) => p.name.includes("ハイロック"))
      const apicaPartner = partnerList.find((p) => p.name.includes("アピカ"))

      const baseUrl = req.headers.origin || "http://localhost:3000"

      // ハイロックデザインオフィスへ送信（アパレル・販促グッズ）
      if (hirockItems.length > 0 && hirockPartner) {
        try {
          await fetch(`${baseUrl}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: hirockPartner.email,
              cc: ["info@splashbrothers.co.jp", storeInfo.email].filter(Boolean).join(", "),
              subject: `発注依頼 - ${orderNumber}（アパレル・販促グッズ）`,
              orderNumber,
              storeName: storeInfo.name,
              partnerName: hirockPartner.name,
              items: hirockItems,
              totalAmount,
            }),
          })
          console.log("Email sent to Hirock:", hirockPartner.email)
        } catch (e) {
          console.warn("Failed to send email to Hirock:", e)
        }
      }

      // 株式会社アピカへ送信（液剤）
      if (apicaItems.length > 0 && apicaPartner) {
        try {
          await fetch(`${baseUrl}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: apicaPartner.email,
              cc: ["info@splashbrothers.co.jp", storeInfo.email].filter(Boolean).join(", "),
              subject: `発注依頼 - ${orderNumber}（液剤）`,
              orderNumber,
              storeName: storeInfo.name,
              partnerName: apicaPartner.name,
              items: apicaItems,
              totalAmount,
            }),
          })
          console.log("Email sent to Apica:", apicaPartner.email)
        } catch (e) {
          console.warn("Failed to send email to Apica:", e)
        }
      }

      // どちらにも属さないアイテムはinfo@splashbrothers.co.jpへ
      if (otherItems.length > 0) {
        try {
          await fetch(`${baseUrl}/api/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: "info@splashbrothers.co.jp",
              cc: storeInfo.email || undefined,
              subject: `発注依頼 - ${orderNumber}`,
              orderNumber,
              storeName: storeInfo.name,
              partnerName: "SPLASH本部",
              items: otherItems,
              totalAmount,
            }),
          })
          console.log("Email sent to info for other items")
        } catch (e) {
          console.warn("Failed to send email for other items:", e)
        }
      }

      return res.status(200).json({
        success: true,
        orderNumber,
        message: "Order saved successfully",
        sheetsUsed: {
          orderHistory: orderResult.sheetUsed,
          hirockHistory: hirockResult.sheetUsed,
        },
      })
    } else {
      // 両方のシートへの保存に失敗した場合
      console.error("Failed to save to any sheets")
      return res.status(500).json({
        error: "Failed to save order data to any available sheets",
        details: {
          orderError: orderResult.error,
          hirockError: hirockResult.error,
        },
      })
    }
  } catch (error) {
    console.error("Error saving order:", error)
    return res.status(500).json({
      error: "Failed to save order data",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
