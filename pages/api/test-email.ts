import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "メールアドレスが必要です" })
    }

    // テスト用の商品データ
    const testItems = [
      {
        name: "テスト商品1",
        selectedSize: "M",
        selectedColor: "ブルー",
        quantity: 2,
      },
      {
        name: "テスト商品2",
        selectedSize: "L",
        selectedColor: "レッド",
        quantity: 1,
      },
    ]

    // メール送信APIを呼び出し
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        subject: "【SPLASH'N'GO!】テストメール",
        orderNumber: "TEST-12345",
        storeName: "テスト店舗",
        items: testItems,
        totalAmount: 5000,
      }),
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      throw new Error(`メール送信エラー: ${errorText}`)
    }

    const data = await emailResponse.json()
    res.status(200).json({ success: true, message: "テストメールを送信しました", data })
  } catch (error) {
    console.error("テストメール送信エラー:", error)
    res.status(500).json({
      error: "テストメールの送信に失敗しました",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

