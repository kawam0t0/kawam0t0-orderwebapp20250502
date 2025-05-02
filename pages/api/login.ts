import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

async function getAuthToken() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set")
  }

  // 修正: GoogleAuth インスタンス自体を返す
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "メールアドレスとパスワードを入力してください" })
    }

    try {
      const auth = await getAuthToken()
      // 修正: auth を直接渡す
      const sheets = google.sheets({
        version: "v4",
        auth,
      })

      // store_infoシートからデータを取得
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: "store_info!A2:G", // ヘッダーを除外してA2から開始
      })

      const rows = response.data.values

      if (!rows || rows.length === 0) {
        return res.status(401).json({ message: "認証情報の取得に失敗しました" })
      }

      // メールアドレスとパスワードの組み合わせを確認
      const user = rows.find((row) => {
        const userEmail = row[5] // F列: メールアドレス
        const userPassword = row[6] // G列: パスワード
        return userEmail === email && userPassword === password
      })

      if (user) {
        // 認証成功
        res.status(200).json({
          message: "ログイン成功",
          user: {
            storeName: user[1], // B列: 店舗名
            email: user[5], // F列: メールアドレス
          },
        })
      } else {
        // 認証失敗
        res.status(401).json({ message: "メールアドレスまたはパスワードが正しくありません" })
      }
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ message: "ログイン処理中にエラーが発生しました" })
    }
  } else {
    res.setHeader("Allow", ["POST"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

