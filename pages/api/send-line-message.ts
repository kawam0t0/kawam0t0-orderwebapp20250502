import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

// LINE Messaging APIのエンドポイント
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message/push"

// 認証トークンの取得
async function getAuthToken() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set")
  }

  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

// 1週間前の日付を取得
function getOneWeekAgoDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`
}

// 日付の比較（date1が古い場合はtrue）
function isDateOlderThan(date1: string, date2: string): boolean {
  const [year1, month1, day1] = date1.split("/").map(Number)
  const [year2, month2, day2] = date2.split("/").map(Number)

  const d1 = new Date(year1, month1 - 1, day1)
  const d2 = new Date(year2, month2 - 1, day2)

  return d1 < d2
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // APIキーの検証（簡易的なセキュリティ）
  const { apiKey } = req.query
  if (apiKey !== process.env.LINE_MESSAGE_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    // スプレッドシートから注文データを取得
    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth,
    })

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Order_history!A2:AU", // A列からAU列まで取得
    })

    if (!response.data.values) {
      return res.status(200).json({ message: "No orders found" })
    }

    // 1週間前の日付を取得
    const oneWeekAgo = getOneWeekAgoDate()

    // 1週間以上前の「処理中」の注文をフィルタリング
    const pendingOrders = response.data.values
      .filter((row) => {
        const orderDate = row[1] || "" // B列: 発注日
        const status = row[46] || "処理中" // AU列: ステータス

        return status === "処理中" && isDateOlderThan(orderDate, oneWeekAgo)
      })
      .map((row) => ({
        orderNumber: row[0] || "", // A列: 発注番号
      }))

    // 処理中の注文がない場合
    if (pendingOrders.length === 0) {
      return res.status(200).json({ message: "No pending orders found" })
    }

    // LINE Messaging APIに必要な環境変数のチェック
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return res.status(500).json({ error: "LINE_CHANNEL_ACCESS_TOKEN is not set" })
    }

    if (!process.env.LINE_GROUP_ID) {
      return res.status(500).json({ error: "LINE_GROUP_ID is not set" })
    }

    // シンプルなテキストメッセージを作成
    const message = {
      type: "text",
      text: "ステータスが1週間以上処理中のものがあります",
    }

    // LINE Messaging APIにメッセージを送信
    const lineResponse = await fetch(LINE_MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: process.env.LINE_GROUP_ID,
        messages: [message],
      }),
    })

    if (!lineResponse.ok) {
      const errorData = await lineResponse.text()
      throw new Error(`LINE Messaging API error: ${errorData}`)
    }

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      pendingOrdersCount: pendingOrders.length,
    })
  } catch (error) {
    console.error("Error sending LINE message:", error)
    res.status(500).json({
      error: "Failed to send message",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

