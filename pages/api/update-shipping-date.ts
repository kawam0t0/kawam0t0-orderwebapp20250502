import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { orderNumber, shippingDate } = req.body

    if (!orderNumber) {
      return res.status(400).json({ error: "Order number is required" })
    }

    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    // hirock_item_historyシートで注文番号に一致する行を検索
    const hirockResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "hirock_item_history!A2:A",
    })

    // 注文番号に一致する行のインデックスを検索
    let rowIndex = -1
    let isHirockOrder = false

    if (hirockResponse.data.values) {
      rowIndex = hirockResponse.data.values.findIndex((row) => row[0] === orderNumber)
      isHirockOrder = rowIndex !== -1
    }

    if (isHirockOrder) {
      // hirock_item_historyシートに該当する注文がある場合
      // 実際のスプレッドシートの行番号（1-indexed）
      const actualRowIndex = rowIndex + 2 // ヘッダー行 + 0-indexedの調整

      // 出荷日を更新（AT列 = 46列目）
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `hirock_item_history!AT${actualRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[shippingDate]],
        },
      })

      // hirock_item_historyシートから注文情報を取得
      try {
        // baseUrlの取得方法を修正
        let baseUrl = ""
        if (process.env.NEXT_PUBLIC_VERCEL_URL) {
          // Vercel環境の場合はhttpsスキーマを追加
          baseUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        } else if (process.env.NEXT_PUBLIC_BASE_URL) {
          // 明示的に設定されたベースURLがある場合はそれを使用
          baseUrl = process.env.NEXT_PUBLIC_BASE_URL
        } else {
          // ローカル開発環境のフォールバック
          baseUrl = "http://localhost:3000"
        }

        // hirock_item_historyシートから注文情報を取得
        const orderInfoResponse = await fetch(`${baseUrl}/api/get-hirock-order-items?orderNumber=${orderNumber}`)

        if (orderInfoResponse.ok) {
          const orderInfo = await orderInfoResponse.json()

          // 出荷通知メールを送信
          if (orderInfo.email) {
            const emailResponse = await fetch(`${baseUrl}/api/send-shipping-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: orderInfo.email,
                orderNumber,
                storeName: orderInfo.storeName,
                shippingDate,
                items: orderInfo.items, // hirock_item_historyシートのアイテムのみ
              }),
            })

            if (!emailResponse.ok) {
              console.error("Failed to send shipping notification email:", await emailResponse.text())
            }
          }
        }
      } catch (emailError) {
        console.error("Error sending shipping notification:", emailError)
        // メール送信エラーは処理を続行するため、ここではスローしない
      }

      res.status(200).json({ success: true, sheet: "hirock_item_history" })
    } else {
      // hirock_item_historyシートに該当する注文がない場合は、Order_historyシートを検索
      const regularResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "Order_history!A2:A",
      })

      if (!regularResponse.data.values) {
        return res.status(404).json({ error: "Order not found in any sheet" })
      }

      // 注文番号に一致する行のインデックスを検索
      rowIndex = regularResponse.data.values.findIndex((row) => row[0] === orderNumber)

      if (rowIndex === -1) {
        return res.status(404).json({ error: "Order not found in any sheet" })
      }

      // 実際のスプレッドシートの行番号（1-indexed）
      const actualRowIndex = rowIndex + 2 // ヘッダー行 + 0-indexedの調整

      // 出荷日を更新（AT列 = 46列目）
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: `Order_history!AT${actualRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[shippingDate]],
        },
      })

      res.status(200).json({ success: true, sheet: "Order_history" })
    }
  } catch (error) {
    console.error("Error updating shipping date:", error)
    res.status(500).json({
      error: "Failed to update shipping date",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
