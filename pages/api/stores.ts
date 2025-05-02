import type { NextApiRequest, NextApiResponse } from "next"
import { google } from "googleapis"

async function getAuthToken() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set")
  }

  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const auth = await getAuthToken()
    const sheets = google.sheets({
      version: "v4",
      auth
    })

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "store_info!B2:B", // B列から店舗名を取得
    })

    const stores = response.data.values
      ? response.data.values.map((row: string[]) => row[0]).filter((store: string) => store && store !== "admin")
      : []

    res.status(200).json(stores)
  } catch (error) {
    console.error("Error fetching stores:", error)
    res.status(500).json({ error: "Failed to fetch store data" })
  }
}
