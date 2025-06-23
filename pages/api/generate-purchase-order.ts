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

      // TO情報
      doc.setFont("helvetica", "bold")
      doc.text("TO:", 110, 75)
      doc.setFont("helvetica", "normal")
      doc.text("Hefei Topwell Machinery Co., Ltd.", 110, 85)
      doc.text("Tel: +8618226629892", 110, 95)
      doc.text("Liv Wang", 110, 105)
      doc.text("Email: liv@topwellclean.com", 110, 115)
      doc.text("Add: #3 Building, Room 3001, Jiaqiao Lehu Mansion,", 110, 125)
      doc.text("     Fanhua Avenue Road, Economic Development Zone,", 110, 135)
      doc.text("     Hefei City, Anhui Province, China", 110, 145)

      // 配送方法
      doc.setFont("helvetica", "bold")
      doc.text(`Shipping Method: `, 20, 165)
      doc.setFont("helvetica", "normal")
      doc.text(`${getShippingMethodText(shippingMethod)}`, 65, 165)

      // テーブルヘッダー（位置と幅を調整）
      doc.setFont("helvetica", "bold")
      doc.text("Item Name", 20, 185)
      doc.text("Category", 85, 185)
      doc.text("Store", 125, 185)
      doc.text("Qty", 165, 185)

      // ヘッダー下の線
      doc.line(20, 190, 185, 190)

      // アイテムリスト
      doc.setFont("helvetica", "normal")
      let yPosition = 200
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

      // Shipping Address（適切なサイズの四角い枠で囲む）
      yPosition += 25

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
      // Excel生成
      const workbook = XLSX.utils.book_new()

      const worksheetData = [
        ["PURCHASE ORDER"],
        [],
        [`Order Number: ${orderNumber}`],
        [`Date: ${currentDate}`],
        [],
        ["FROM:", "Splash Brothers Inc."],
        ["Email:", storeInfo.email],
        [],
        ["TO:", "Hefei Topwell Machinery Co., Ltd."],
        ["Tel:", "+8618226629892"],
        ["Contact:", "Liv Wang"],
        ["Email:", "liv@topwellclean.com"],
        ["Address:", "#3 Building, Room 3001, Jiaqiao Lehu Mansion,"],
        ["", "Fanhua Avenue Road, Economic Development Zone,"],
        ["", "Hefei City, Anhui Province, China"],
        [],
        [`Shipping Method: ${getShippingMethodText(shippingMethod)}`],
        [],
        ["Item Name", "Category", "Store Name", "Quantity"],
        ...items.map((item) => [item.itemName, item.category, item.storeName, item.quantity]),
        [],
        ["Total Items:", items.length],
        ["Total Quantity:", items.reduce((sum, item) => sum + item.quantity, 0)],
        [],
        ["=== SHIPPING ADDRESS ==="],
        ["Shipping Address:", "SPLASH'N'GO!"],
        ["Attn:", "Person in Charge"],
        ["Address:", "2-4-15 Amagawa-Oshima-machi, Maebashi-shi"],
        ["", "Gunma 379-2154"],
        ["Country:", "Japan"],
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
