import type { NextApiRequest, NextApiResponse } from "next"
import { jsPDF } from "jspdf"
import ExcelJS from "exceljs"

// 型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
  imageUrl?: string
}

type StoreInfo = {
  name: string
  email: string
  id: string
}

// 画像をダウンロードしてBufferに変換する関数
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status} ${response.statusText}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error("Error downloading image:", error)
    return null
  }
}

// 画像の拡張子を取得する関数（ExcelJSで許可される型のみ）
function getImageExtension(url: string): "jpeg" | "png" | "gif" {
  const urlParts = url.split(".")
  const extension = urlParts[urlParts.length - 1].toLowerCase().split("?")[0]

  // ExcelJSで許可される拡張子のみ
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "jpeg"
    case "png":
      return "png"
    case "gif":
      return "gif"
    default:
      return "jpeg" // デフォルトはjpeg
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    const { items, storeInfo, shippingMethod, format } = req.body as {
      items: PartsCartItem[]
      storeInfo: StoreInfo
      shippingMethod: string
      format: "pdf" | "excel"
    }

    if (!items || !storeInfo || !format) {
      return res.status(400).json({ error: "Missing required data" })
    }

    const orderNumber = `PO-${Date.now().toString().slice(-5)}`
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const getShippingMethodText = (method: string) => {
      switch (method) {
        case "air":
          return "Air shipment"
        case "sea":
          return "Sea shipment"
        case "next_order":
          return "At the same time as the next car wash machine order"
        default:
          return method
      }
    }

    if (format === "pdf") {
      // PDF生成
      const doc = new jsPDF()

      // ヘッダー
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.text("PURCHASE ORDER", 105, 25, { align: "center" })

      // 基本情報
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      doc.text(`Order Number: ${orderNumber}`, 20, 45)
      doc.text(`Date: ${currentDate}`, 20, 55)

      // FROM情報
      doc.setFont("helvetica", "bold")
      doc.text("FROM:", 20, 75)
      doc.setFont("helvetica", "normal")
      doc.text("Splash Brothers Inc.", 20, 85)
      doc.text(`Email: ${storeInfo.email}`, 20, 95)

      // TO情報（改行を追加して短く）
      doc.setFont("helvetica", "bold")
      doc.text("TO:", 110, 75)
      doc.setFont("helvetica", "normal")
      doc.text("Hefei Topwell Machinery Co., Ltd.", 110, 85)
      doc.text("Tel: +8618226629892", 110, 95)
      doc.text("Liv Wang", 110, 105)
      doc.text("Email: liv@topwellclean.com", 110, 115)
      doc.text("Add: #3 Building, Room 3001,", 110, 125)
      doc.text("     Jiaqiao Lehu Mansion,", 110, 135)
      doc.text("     Fanhua Avenue Road, Economic", 110, 145)
      doc.text("     Development Zone,", 110, 155)
      doc.text("     Hefei City, Anhui Province, China", 110, 165)

      // 配送方法
      doc.setFont("helvetica", "bold")
      doc.text(`Shipping Method: `, 20, 185)
      doc.setFont("helvetica", "normal")
      doc.text(`${getShippingMethodText(shippingMethod)}`, 65, 185)

      // テーブルヘッダー（位置と幅を調整）
      doc.setFont("helvetica", "bold")
      doc.text("Item Name", 20, 205)
      doc.text("Category", 85, 205)
      doc.text("Store", 125, 205)
      doc.text("Qty", 165, 205)

      // ヘッダー下の線
      doc.line(20, 210, 185, 210)

      // アイテムリスト
      doc.setFont("helvetica", "normal")
      let yPosition = 220
      items.forEach((item, index) => {
        // 長い文字列は適切に切り詰める
        const itemName = item.itemName.length > 30 ? item.itemName.substring(0, 27) + "..." : item.itemName
        const category = item.category.length > 15 ? item.category.substring(0, 12) + "..." : item.category
        const storeName = item.storeName.length > 15 ? item.storeName.substring(0, 12) + "..." : item.storeName

        doc.text(itemName, 20, yPosition)
        doc.text(category, 85, yPosition)
        doc.text(storeName, 125, yPosition)
        doc.text(item.quantity.toString(), 165, yPosition)
        yPosition += 10
      })

      // 合計行の上の線
      doc.line(20, yPosition + 5, 185, yPosition + 5)
      yPosition += 15

      // 合計情報
      doc.setFont("helvetica", "bold")
      doc.text(`Total Items: ${items.length}`, 20, yPosition)
      doc.text(`Total Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}`, 125, yPosition)

      // Shipping Address（ページの残りスペースをチェック）
      yPosition += 25
      const pageHeight = 297 // A4の高さ（mm）
      const remainingSpace = pageHeight - yPosition
      const requiredSpace = 65 // Shipping Addressに必要なスペース

      // 残りスペースが足りない場合は新しいページを追加
      if (remainingSpace < requiredSpace) {
        doc.addPage()
        yPosition = 30 // 新しいページの開始位置
      }

      // 四角い枠を描画（高さを調整）
      const boxHeight = 55
      doc.rect(20, yPosition, 165, boxHeight)

      // Shipping Address内容（枠内に適切に配置）
      doc.setFont("helvetica", "bold")
      doc.text("Shipping Address:", 25, yPosition + 12)

      doc.setFont("helvetica", "normal")
      doc.text("SPLASH'N'GO!", 25, yPosition + 22)
      doc.text("Attn: Person in Charge", 25, yPosition + 32)
      doc.text("2-4-15 Amagawa-Oshima-machi, Maebashi-shi", 25, yPosition + 42)
      doc.text("Gunma 379-2154, Japan", 25, yPosition + 52)

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="purchase_order_${orderNumber}.pdf"`)
      res.send(pdfBuffer)
    } else if (format === "excel") {
      // Excel生成 - 画像をシンプルに左上配置
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Parts Order List")

      // ヘッダー行を設定
      const headers = [
        "date",
        "Items from",
        "category",
        "item_name",
        "amount",
        "Shipping_method",
        "image",
        "UnitPrice",
        "TotalPrice",
      ]

      // ヘッダー行を追加
      const headerRow = worksheet.addRow(headers)
      headerRow.height = 25

      // ヘッダーのスタイルを設定
      headerRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.alignment = { horizontal: "left", vertical: "middle" }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE6E6E6" },
        }
      })

      // 発注日付を取得（YYYY/MM/DD形式）
      const orderDate = new Date().toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tokyo",
      })

      // 各アイテムの行を追加
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const rowIndex = i + 2 // ヘッダー行の次から開始

        // データ行を追加
        const dataRow = worksheet.addRow([
          orderDate, // date
          item.storeName, // Items from
          item.category, // category
          item.itemName, // item_name
          item.quantity, // amount
          getShippingMethodText(shippingMethod).split(" ")[0], // Shipping_method
          "", // image列は空にして後で画像を挿入
          "", // UnitPrice
          "", // TotalPrice
        ])

        // 行の高さを設定（画像用に高くする）
        dataRow.height = 60

        // セルの配置を左揃えに設定
        dataRow.eachCell((cell) => {
          cell.alignment = { horizontal: "left", vertical: "middle" }
        })

        // 画像がある場合は埋め込み（シンプルに左上配置）
        if (item.imageUrl) {
          try {
            console.log(`Downloading image for item ${i + 1}: ${item.imageUrl}`)
            const imageBuffer = await downloadImage(item.imageUrl)

            if (imageBuffer) {
              const imageExtension = getImageExtension(item.imageUrl)

              // 画像をワークブックに追加
              const imageId = workbook.addImage({
                buffer: imageBuffer as any,
                extension: imageExtension,
              })

              // 画像をセルに配置 - シンプルに左上配置（デフォルト）
              worksheet.addImage(imageId, {
                tl: { col: 6, row: rowIndex - 1 },
                ext: { width: 80, height: 50 },
              })

              console.log(`Successfully embedded image for item ${i + 1}`)
            } else {
              console.log(`Failed to download image for item ${i + 1}`)
              // 画像の取得に失敗した場合はURLを表示
              const imageCell = worksheet.getCell(rowIndex, 7) // G列
              imageCell.value = item.imageUrl
            }
          } catch (error) {
            console.error(`Error processing image for item ${i + 1}:`, error)
            // エラーの場合はURLを表示
            const imageCell = worksheet.getCell(rowIndex, 7) // G列
            imageCell.value = item.imageUrl
          }
        }
      }

      // 列幅を設定
      worksheet.columns = [
        { width: 12 }, // date
        { width: 18 }, // Items from
        { width: 15 }, // category
        { width: 25 }, // item_name
        { width: 8 }, // amount
        { width: 15 }, // Shipping_method
        { width: 15 }, // image
        { width: 12 }, // UnitPrice
        { width: 12 }, // TotalPrice
      ]

      // Excelファイルを生成
      const excelBuffer = await workbook.xlsx.writeBuffer()

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", `attachment; filename="parts_order_list_${orderNumber}.xlsx"`)
      res.send(Buffer.from(excelBuffer))
    }
  } catch (error) {
    console.error("Error generating purchase order:", error)
    res.status(500).json({
      error: "Failed to generate purchase order",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
