import type { NextApiRequest, NextApiResponse } from "next"
import nodemailer from "nodemailer"

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

type PartsOrderItem = {
  storeName: string
  category: string
  itemName: string
  quantity: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { to, orderNumber, storeName, items, shippingMethod } = req.body as {
      to: string
      orderNumber: string
      storeName: string
      items: PartsOrderItem[]
      shippingMethod: string
    }

    console.log("=== 部品発注確認メール送信開始 ===")
    console.log("送信先:", to)
    console.log("Cc:", "info@splashbrothers.co.jp")
    console.log("発注番号:", orderNumber)
    console.log("発注者:", storeName)
    console.log("部品数:", items?.length || 0)
    console.log("配送方法:", shippingMethod)

    if (!to || !orderNumber || !storeName || !items || !shippingMethod) {
      console.error("部品発注メール: 必要なパラメータが不足しています:", {
        to,
        orderNumber,
        storeName,
        hasItems: !!items,
        shippingMethod,
      })
      return res.status(400).json({ error: "必要なパラメータが不足しています" })
    }

    // SMTP設定の確認
    console.log("SMTP設定:")
    console.log("- Host:", process.env.SMTP_HOST || "smtp.gmail.com")
    console.log("- Port:", Number(process.env.SMTP_PORT) || 587)
    console.log("- User:", process.env.SMTP_USER ? "設定済み" : "未設定")
    console.log("- Pass:", process.env.SMTP_PASSWORD ? "設定済み" : "未設定")

    // 配送方法のテキスト変換
    const getShippingMethodText = (method: string) => {
      switch (method) {
        case "air":
          return "Air shipment (航空便)"
        case "sea":
          return "Sea shipment (船便)"
        case "next_order":
          return "At the same time as the next car wash machine order (次回洗車機注文と同時)"
        default:
          return method
      }
    }

    // 部品リストのHTMLを生成
    const itemsHtml = items
      .map(
        (item: PartsOrderItem) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.itemName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.storeName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}個</td>
        </tr>
      `,
      )
      .join("")

    // 合計数量を計算
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

    // メール本文のHTML
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(to right, #eab308, #f59e0b); color: black; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SPLASH'N'GO!</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">部品発注確認</p>
      </div>
      
      <div style="padding: 25px; background-color: #fffbeb; border-left: 1px solid #fde68a; border-right: 1px solid #fde68a;">
        <p style="color: #334155;">${storeName} 様</p>
        <p style="color: #334155;">この度は部品のご発注をいただき、誠にありがとうございます。<br>以下の内容でご発注を承りました。</p>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #fde68a;">
          <h2 style="margin-top: 0; color: #d97706; font-size: 18px; border-bottom: 2px solid #fde68a; padding-bottom: 10px;">発注情報</h2>
          <p style="color: #334155;"><strong style="color: #d97706;">発注番号:</strong> ${orderNumber}</p>
          <p style="color: #334155;"><strong style="color: #d97706;">発注日時:</strong> ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
          <p style="color: #334155;"><strong style="color: #d97706;">配送方法:</strong> ${getShippingMethodText(shippingMethod)}</p>
          
          <h3 style="margin: 20px 0 10px; color: #d97706; font-size: 16px;">発注部品</h3>
          <table style="width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #fef3c7;">
                <th style="padding: 10px; text-align: left; color: #d97706; font-weight: 600;">部品名</th>
                <th style="padding: 10px; text-align: center; color: #d97706; font-weight: 600;">カテゴリー</th>
                <th style="padding: 10px; text-align: center; color: #d97706; font-weight: 600;">店舗</th>
                <th style="padding: 10px; text-align: center; color: #d97706; font-weight: 600;">数量</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #fde68a;">
            <p style="color: #334155; font-size: 16px;"><strong style="color: #d97706;">合計部品種類:</strong> ${items.length}種類</p>
            <p style="color: #334155; font-size: 16px;"><strong style="color: #d97706;">合計数量:</strong> ${totalQuantity}個</p>
          </div>
        </div>
        
        <p style="color: #334155; background-color: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
          部品の手配を開始いたします。<br>
          進捗状況につきましては、別途ご連絡させていただきます。<br>
          ご不明な点がございましたら、お気軽にお問い合わせください。
        </p>
      </div>
      
      <div style="background-color: #92400e; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 5px;">© 2025 SPLASH'N'GO! All rights reserved.</p>
        <p style="margin: 0;">お問い合わせ: <a href="mailto:info@splashbrothers.co.jp" style="color: #fbbf24;">info@splashbrothers.co.jp</a> | 050-1748-0947</p>
      </div>
    </div>
    `

    console.log("部品発注確認メール送信を実行中...")

    // メール送信（Ccを追加）
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
      to,
      cc: "info@splashbrothers.co.jp", // Ccを追加
      subject: `【SPLASH'N'GO!】部品発注確認 (${orderNumber})`,
      html,
    })

    console.log("部品発注確認メール送信成功:", info.messageId)
    console.log("=== 部品発注確認メール送信完了 ===")

    res.status(200).json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("部品発注確認メール送信エラー:", error)
    res
      .status(500)
      .json({ error: "メールの送信に失敗しました", details: error instanceof Error ? error.message : "Unknown error" })
  }
}
