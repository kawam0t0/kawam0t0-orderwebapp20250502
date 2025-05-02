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

type PartnerEmailItem = {
  item_name: string
  item_category: string
  selectedSize?: string
  selectedColor?: string
  quantity: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { to, subject, orderNumber, storeName, items } = req.body as {
      to: string
      subject: string
      orderNumber: string
      storeName: string
      items: PartnerEmailItem[]
    }

    console.log("Partner email request received:", {
      to,
      subject,
      orderNumber,
      storeName,
      itemCount: items?.length || 0,
    })

    if (!to || !subject || !orderNumber || !storeName || !items) {
      console.error("Missing parameters:", { to, subject, orderNumber, storeName, hasItems: !!items })
      return res.status(400).json({ error: "必要なパラメータが不足しています" })
    }

    // 商品リストのHTMLを生成
    const itemsHtml = items
      .map(
        (item: PartnerEmailItem) => `
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

    // メール送信
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
      to,
      subject,
      html,
    })

    console.log("Partner email sent successfully:", info.messageId)
    res.status(200).json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("パートナーメール送信エラー:", error)
    res
      .status(500)
      .json({ error: "メールの送信に失敗しました", details: error instanceof Error ? error.message : "Unknown error" })
  }
}

