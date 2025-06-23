import type { NextApiRequest, NextApiResponse } from "next"
import { jsPDF } from "jspdf"
import * as XLSX from "xlsx"

// 型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
}

type StoreInfo = {
  name: string
  email: string
  id: string
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
      doc.text("PURCHASE ORDER", 105, 20, { align: "center" })

      doc.setFontSize(12)
      doc.text(`Order Number: ${orderNumber}`, 20, 40)
      doc.text(`Date: ${currentDate}`, 20, 50)

      // 発注者情報
      doc.text("FROM:", 20, 70)
      doc.text(`${storeInfo.name}`, 20, 80)
      doc.text(`Email: ${storeInfo.email}`, 20, 90)

      // 配送先情報
      doc.text("TO:", 120, 70)
      doc.text("SPLASH'N'GO! Parts Supplier", 120, 80)
      doc.text("China", 120, 90)

      // 配送方法
      doc.text(`Shipping Method: ${getShippingMethodText(shippingMethod)}`, 20, 110)

      // テーブルヘッダー
      doc.text("Item", 20, 130)
      doc.text("Category", 80, 130)
      doc.text("Store", 120, 130)
      doc.text("Qty", 170, 130)

      // 線を引く
      doc.line(20, 135, 190, 135)

      // アイテムリスト
      let yPosition = 145
      items.forEach((item, index) => {
        doc.text(item.itemName.substring(0, 25), 20, yPosition)
        doc.text(item.category, 80, yPosition)
        doc.text(item.storeName.substring(0, 15), 120, yPosition)
        doc.text(item.quantity.toString(), 170, yPosition)
        yPosition += 10
      })

      // 合計
      doc.line(20, yPosition, 190, yPosition)
      yPosition += 10
      doc.text(`Total Items: ${items.length}`, 20, yPosition)
      doc.text(`Total Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}`, 120, yPosition)

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="purchase_order_${orderNumber}.pdf"`)
      res.send(pdfBuffer)
    } else if (format === "excel") {
      // Excel生成
      const workbook = XLSX.utils.book_new()

      const worksheetData = [
        ["PURCHASE ORDER"],
        [],
        [`Order Number: ${orderNumber}`],
        [`Date: ${currentDate}`],
        [],
        ["FROM:", storeInfo.name],
        ["Email:", storeInfo.email],
        [],
        ["TO:", "SPLASH'N'GO! Parts Supplier"],
        ["Location:", "China"],
        [],
        [`Shipping Method: ${getShippingMethodText(shippingMethod)}`],
        [],
        ["Item Name", "Category", "Store Name", "Quantity"],
        ...items.map((item) => [item.itemName, item.category, item.storeName, item.quantity]),
        [],
        ["Total Items:", items.length],
        ["Total Quantity:", items.reduce((sum, item) => sum + item.quantity, 0)],
      ]

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Order")

      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", `attachment; filename="purchase_order_${orderNumber}.xlsx"`)
      res.send(excelBuffer)
    }
  } catch (error) {
    console.error("Error generating purchase order:", error)
    res.status(500).json({
      error: "Failed to generate purchase order",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
