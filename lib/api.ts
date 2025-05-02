import { google } from "googleapis"
import { cache } from "react"

export async function getAuthToken() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set")
  }

  // 修正: GoogleAuth インスタンス自体を返す
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
}

export const getStores = cache(async () => {
  const auth = await getAuthToken()
  // 修正: auth を直接渡す
  const sheets = google.sheets({
    version: "v4",
    auth
  })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: "store_info!A2:F",
    // auth パラメータは不要になった
  })

  const rows = response.data.values || []
  return rows
    .filter((row) => row[1] !== "admin")
    .map((row) => ({
      id: row[0],
      name: row[1],
      email: row[5],
    }))
})
