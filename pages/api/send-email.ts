import type { NextApiRequest, NextApiResponse } from "next"
import nodemailer from "nodemailer"

// メール送信用のトランスポーターを設定
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,
  name: "mail.splashbrothers.co.jp",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: "TLSv1.2",
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { to, cc, subject, orderNumber, storeName, partnerName, items, totalAmount } = req.body

    console.log("=== 発注依頼メール送信開始 ===")
    console.log("送信先(To):", to)
    console.log("Cc:", cc)
    console.log("件名:", subject)
    console.log("発注番号:", orderNumber)
    console.log("店舗名:", storeName)
    console.log("取引先名:", partnerName)
    console.log("商品数:", items?.length || 0)
    console.log("合計金額:", totalAmount)

    if (!to || !subject || !orderNumber || !storeName || !items) {
      console.error("必要なパラメータが不足しています:", { to, subject, orderNumber, storeName, hasItems: !!items })
      return res.status(400).json({ error: "必要なパラメータが不足しています" })
    }

    console.log("SMTP設定:")
    console.log("- Host:", process.env.SMTP_HOST || "smtp.gmail.com")
    console.log("- Port:", Number(process.env.SMTP_PORT) || 587)
    console.log("- User:", process.env.SMTP_USER ? "設定済み" : "未設定")
    console.log("- Pass:", process.env.SMTP_PASSWORD ? "設定済み" : "未設定")

    // 商品リストのHTMLを生成
    const itemsHtml = items
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.item_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.selectedSize || "-"}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.selectedColor || "-"}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">¥${Number(item.item_price || 0).toLocaleString()}</td>
        </tr>
      `,
      )
      .join("")

    const formattedTotal = new Intl.NumberFormat("ja-JP").format(totalAmount)
    const displayPartnerName = partnerName || to
    const orderDate = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })

    // メール本文（取引先への発注依頼）
    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3D55D8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SPLASH'N'GO!</h1>
        <p style="margin: 5px 0 0; font-size: 16px;">発注依頼</p>
      </div>

      <div style="padding: 25px; background-color: #f0f9ff; border-left: 1px solid #e0f2fe; border-right: 1px solid #e0f2fe;">
        <p style="color: #334155;">${displayPartnerName} 御中</p>
        <p style="color: #334155;">
          いつもお世話になっております。SPLASH'N'GO!です。<br>
          下記の通り発注をお願いいたします。<br>
          ご確認のうえ、出荷のほどよろしくお願いいたします。
        </p>

        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #bae6fd;">
          <h2 style="margin-top: 0; color: #3D55D8; font-size: 18px; border-bottom: 2px solid #e0f2fe; padding-bottom: 10px;">発注情報</h2>
          <p style="color: #334155;"><strong style="color: #3D55D8;">発注番号:</strong> ${orderNumber}</p>
          <p style="color: #334155;"><strong style="color: #3D55D8;">発注日時:</strong> ${orderDate}</p>
          <p style="color: #334155;"><strong style="color: #3D55D8;">発注店舗:</strong> ${storeName}</p>

          <h3 style="margin: 20px 0 10px; color: #3D55D8; font-size: 16px;">発注商品一覧</h3>
          <table style="width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #e0f2fe;">
                <th style="padding: 10px; text-align: left; color: #3D55D8; font-weight: 600;">商品名</th>
                <th style="padding: 10px; text-align: center; color: #3D55D8; font-weight: 600;">サイズ</th>
                <th style="padding: 10px; text-align: center; color: #3D55D8; font-weight: 600;">カラー</th>
                <th style="padding: 10px; text-align: center; color: #3D55D8; font-weight: 600;">数量</th>
                <th style="padding: 10px; text-align: right; color: #3D55D8; font-weight: 600;">金額</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; text-align: right; padding-top: 10px; border-top: 1px solid #e0f2fe;">
            <p style="color: #334155; font-size: 16px;"><strong style="color: #3D55D8;">合計金額（税込）:</strong> ¥${formattedTotal}</p>
          </div>
        </div>

        <p style="color: #334155; background-color: #dbeafe; padding: 12px; border-radius: 6px; border-left: 4px solid #3D55D8;">
          ご不明な点がございましたら、下記までお問い合わせください。<br>
          SPLASH'N'GO! 本部　TEL: 050-1748-0947
        </p>
      </div>

      <div style="background-color: #0c4a6e; color: white; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 5px;">© 2025 SPLASH'N'GO! All rights reserved.</p>
        <p style="margin: 0;">お問い合わせ: <a href="mailto:info@splashbrothers.co.jp" style="color: #7dd3fc;">info@splashbrothers.co.jp</a> | 050-1748-0947</p>
      </div>
    </div>
    `

    console.log("メール送信を実行中...")

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"SPLASH'N'GO!" <${process.env.SMTP_USER}>`,
      to,
      cc: cc || undefined,
      subject,
      html,
    })

    console.log("発注依頼メール送信成功:", info.messageId)
    console.log("=== 発注依頼メール送信完了 ===")
    res.status(200).json({ success: true, messageId: info.messageId })
  } catch (error) {
    console.error("発注依頼メール送信エラー:", error)
    res
      .status(500)
      .json({ error: "メールの送信に失敗しました", details: error instanceof Error ? error.message : "Unknown error" })
  }
}
