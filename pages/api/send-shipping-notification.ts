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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { to, orderNumber, storeName, shippingDate, items } = req.body

    if (!to || !orderNumber || !storeName || !shippingDate) {
      return res.status(400).json({ error: "必要なパラメータが不足しています" })
    }

    // 出荷日をフォーマット
    const formattedDate = new Date(shippingDate).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    })

    // 商品リストのHTMLを生成
    const itemsHtml =
      items && items.length > 0
        ? `
        <div style="margin-top: 15px;">
          <h3 style="color: #0284c7; font-size: 16px; margin-bottom: 10px;">商品リスト</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0f2fe;">
            <thead>
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 8px; text-align: left; border: 1px solid #bae6fd;">商品名</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #bae6fd;">サイズ</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #bae6fd;">カラー</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #bae6fd;">数量</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #e0f2fe;">${item.name}</td>
                  <td style="padding: 8px; text-align: center; border: 1px solid #e0f2fe;">${item.size || "-"}</td>
                  <td style="padding: 8px; text-align: center; border: 1px solid #e0f2fe;">${item.color || "-"}</td>
                  <td style="padding: 8px; text-align: center; border: 1px solid #e0f2fe;">${item.quantity}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
        : '<p style="color: #334155; font-style: italic;">商品情報はありません</p>'

    // メール本文のHTML
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(to right, #3b82f6, #0ea5e9); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SPLASH'N'GO!</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">商品出荷のお知らせ</p>
      </div>
      
      <div style="padding: 25px; background-color: #f0f9ff; border-left: 1px solid #e0f2fe; border-right: 1px solid #e0f2fe;">
        <p style="color: #334155;">${storeName} 様</p>
        <p style="color: #334155;">お世話になっております。<br>ご注文いただいた商品を出荷いたしましたのでお知らせいたします。</p>
        
        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #bae6fd;">
          <h2 style="margin-top: 0; color: #0284c7; font-size: 18px; border-bottom: 2px solid #e0f2fe; padding-bottom: 10px;">出荷情報</h2>
          <p style="color: #334155;"><strong style="color: #0284c7;">発注番号:</strong> ${orderNumber}</p>
          <p style="color: #334155;"><strong style="color: #0284c7;">出荷日:</strong> ${formattedDate}</p>
          ${itemsHtml}
        </div>
        
        <p style="color: #334155; background-color: #dbeafe; padding: 12px; border-radius: 6px; border-left: 4px solid #3b82f6;">
          商品の到着まで今しばらくお待ちください。<br>
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
      subject: `【SPLASH'N'GO!】ご注文商品の出荷完了のお知らせ (${orderNumber})`,
      html,
    })

    console.log("Shipping notification email sent successfully:", info.messageId)
    res.status(200).json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("出荷通知メール送信エラー:", error)
    res.status(500).json({
      error: "メールの送信に失敗しました",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

