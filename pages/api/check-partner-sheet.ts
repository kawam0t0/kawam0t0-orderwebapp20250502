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
      auth,
    })

    // スプレッドシートの情報を取得
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.SHEET_ID,
    })

    // シート一覧を取得
    const sheetsList = spreadsheet.data.sheets?.map((sheet) => ({
      title: sheet.properties?.title,
      sheetId: sheet.properties?.sheetId,
    }))

    // partner_infoシートが存在するか確認
    const partnersSheet = sheetsList?.find((sheet) => sheet.title === "partner_info")

    if (!partnersSheet) {
      return res.status(200).json({
        exists: false,
        sheets: sheetsList,
        message:
          "partner_infoシートが見つかりません。スプレッドシートにpartner_infoという名前のシートを作成してください。",
      })
    }

    // partner_infoシートの内容を取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "partner_info!A1:C",
    })

    const headers = response.data.values?.[0] || []
    const rows = response.data.values?.slice(1) || []

    return res.status(200).json({
      exists: true,
      headers,
      rowCount: rows.length,
      sampleData: rows.slice(0, 3),
      message: "partner_infoシートが見つかりました。",
    })
  } catch (error) {
    console.error("Error checking partner sheet:", error)
    res.status(500).json({
      error: "Failed to check partner sheet",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

