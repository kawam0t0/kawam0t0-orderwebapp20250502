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
    const { to, subject, orderNumber, storeName, items, totalAmount } = req.body

    console.log("=== 発注確認メール送信開始 ===")
    console.log("送信先:", to)
    console.log("Cc:", "info@splashbrothers.co.jp")
    console.log("件名:", subject)
    console.log("発注番号:", orderNumber)
    console.log("店舗名:", storeName)
    console.log("商品数:", items?.length || 0)
    console.log("合計金額:", totalAmount)

    if (!to || !subject || !orderNumber || !storeName || !items) {
      console.error("必要なパラメータが不足しています:", { to, subject, orderNumber, storeName, hasItems: !!items })
      return res.status(400).json({ error: "必要なパラメータが不足しています" })
    }

    // SMTP設定の確認
    console.log("SMTP設定:")
    console.log("- Host:", process.env.SMTP_HOST || "smtp.gmail.com")
    console.log("- Port:", Number(process.env.SMTP_PORT) || 587)
    console.log("- User:", process.env.SMTP_USER ? "設定済み" : "未設定")
    console.log("- Pass:", process.env.SMTP_PASSWORD ? "設定済み" : "未設定")

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

    console.log("メール送信を実行中...")

    // メール送信（Ccを追加）
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "\"SPLASH'N'GO!\" <noreply@splashngo.example.com>",
      to,
      cc: "info@splashbrothers.co.jp", // Ccを追加
      subject,
      html,
    })

    console.log("発注確認メール送信成功:", info.messageId)
    console.log("=== 発注確認メール送信完了 ===")

    res.status(200).json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("発注確認メール送信エラー:", error)
    res
      .status(500)
      .json({ error: "メールの送信に失敗しました", details: error instanceof Error ? error.message : "Unknown error" })
  }
}
