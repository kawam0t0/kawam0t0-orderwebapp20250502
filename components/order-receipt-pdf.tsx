"use client"

import jsPDF from "jspdf"
import "jspdf-autotable"

// jspdf-autotable の型拡張
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

// ========== 価格ロジック（products/page.tsx と共有） ==========

const FIXED_QUANTITY_PRICE_MAP: { [key: string]: { quantity: number; price: number }[] } = {
  ポイントカード: [
    { quantity: 1000, price: 29370 },
    { quantity: 3000, price: 46090 },
    { quantity: 5000, price: 62920 },
  ],
  サブスクメンバーズカード: [
    { quantity: 1000, price: 36080 },
    { quantity: 2000, price: 60000 },
    { quantity: 2500, price: 75000 },
    { quantity: 3000, price: 84000 },
  ],
  サブスクフライヤー: [
    { quantity: 500, price: 6600 },
    { quantity: 1000, price: 7370 },
    { quantity: 1500, price: 8360 },
  ],
  フリーチケット: [{ quantity: 1000, price: 23100 }],
  クーポン券: [{ quantity: 1000, price: 42680 }],
  "のぼり(10枚1セット)": [{ quantity: 10, price: 26620 }],
  "のぼり(6枚1セット)": [{ quantity: 6, price: 19140 }],
  お年賀: [{ quantity: 100, price: 25000 }],
  利用規約: [
    { quantity: 500, price: 10000 },
    { quantity: 1000, price: 20000 },
  ],
  ピッカークロス: [
    { quantity: 1, price: 30000 },
    { quantity: 2, price: 60000 },
    { quantity: 3, price: 90000 },
  ],
}

const LIQUID_PRICES: { [key: string]: number } = {
  スプシャン: 6000,
  スプワックス: 40000,
  スプコート: 25000,
  セラミック: 120000,
  スプタイヤ: 7000,
  ピッカークロスミニ: 30000,
}

const TSHIRT_PRICES: { [size: string]: number } = {
  M: 1810,
  L: 1810,
  XL: 1810,
  XXL: 2040,
}

const HOODIE_PRICES: { [size: string]: number } = {
  M: 3210,
  L: 3210,
  XL: 3210,
  XXL: 3770,
  XXXL: 4000,
}

const STORE_SPECIFIC_PRICES: { [storeName: string]: { [product: string]: number } } = {
  "SPLASH'N'GO!伊勢崎韮塚店": { スプワックス: 40000, スプコート: 25000 },
  "SPLASH'N'GO!高崎棟高店": { スプワックス: 37000, スプコート: 23000 },
  "SPLASH'N'GO!足利緑町店": { スプワックス: 37000, スプコート: 23000 },
  "SPLASH'N'GO!新前橋店": { スプワックス: 26000, スプコート: 20000 },
}

const courseStickers = [
  "コースシール（Premium）",
  "コースシール（CoatingPlus）",
  "コースシール（Niagara）",
  "コースシール（Ceramic）",
]
const COURSE_STICKER_PRICES: { quantity: number; price: number }[] = [
  { quantity: 300, price: 10252 },
  { quantity: 500, price: 10670 },
  { quantity: 1000, price: 11506 },
]

const isCourseSticker = (name: string) => courseStickers.some((s) => name.includes(s))
const isLiquidItem = (name: string) =>
  ["スプシャン", "スプワックス", "スプコート", "セラミック", "スプタイヤ", "ピッカークロスミニ"].some((k) =>
    name.includes(k),
  )
const isApparelItem = (name: string) =>
  ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"].some((k) => name.includes(k))
const isSpecificProduct = (name: string, key: string) => name.includes(key)

function getStoreSpecificPrice(productName: string, storeName: string): number | null {
  const storeMap = STORE_SPECIFIC_PRICES[storeName]
  if (!storeMap) return null
  const key = Object.keys(storeMap).find((k) => productName.includes(k))
  return key ? storeMap[key] : null
}

/** アイテム1件の合計金額を計算 */
export function calcItemPrice(
  name: string,
  size: string,
  quantityStr: string,
  storeName: string,
): number {
  const qty = Number(quantityStr) || 1

  // コースシール
  if (isCourseSticker(name)) {
    const entry = COURSE_STICKER_PRICES.find((e) => e.quantity === qty)
    return entry ? entry.price : COURSE_STICKER_PRICES[0].price
  }

  // 固定数量価格マップ (ポイントカード, のぼり, ピッカークロス など)
  for (const [key, entries] of Object.entries(FIXED_QUANTITY_PRICE_MAP)) {
    if (isSpecificProduct(name, key)) {
      const entry = entries.find((e) => e.quantity === qty)
      if (entry) return entry.price
      return entries[0].price
    }
  }

  // 液剤
  if (isLiquidItem(name)) {
    const storePrice = getStoreSpecificPrice(name, storeName)
    if (storePrice !== null) return storePrice * qty
    for (const [key, price] of Object.entries(LIQUID_PRICES)) {
      if (name.includes(key)) return price * qty
    }
    return 0
  }

  // アパレル
  if (name.includes("Tシャツ")) {
    return (TSHIRT_PRICES[size] ?? 1810) * qty
  }
  if (name.includes("フーディ")) {
    return (HOODIE_PRICES[size] ?? 3210) * qty
  }

  return 0
}

// ========== 型定義 ==========

export type OrderItem = {
  name: string
  size?: string
  color?: string
  quantity?: string
}

export type OrderRecord = {
  orderId: string
  orderDate: string
  storeName: string
  items: OrderItem[] | string
}

// ========== PDF生成 ==========

export async function generateReceiptPDF(
  orders: OrderRecord[],
  storeName: string,
  monthLabel: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  // フォントは標準の helvetica を使用。日本語は画像化せずテキストで埋め込む。
  // jsPDF はデフォルトでは日本語フォントを持たないため、
  // 代わりにカスタムフォント（NotoSansJP など）を Base64 で埋め込む方法が一般的ですが、
  // ここではブラウザの Canvas を利用した「HTML → Canvas → jsPDF」アプローチを採用し、
  // 日本語テキストを正しくレンダリングします。

  await generateReceiptPDFWithCanvas(orders, storeName, monthLabel)
}

async function generateReceiptPDFWithCanvas(
  orders: OrderRecord[],
  storeName: string,
  monthLabel: string,
): Promise<void> {
  // ブラウザ上で非表示の div を作成してレンダリング
  const container = document.createElement("div")
  container.style.position = "fixed"
  container.style.left = "-9999px"
  container.style.top = "0"
  container.style.width = "794px" // A4 96dpi
  container.style.fontFamily = "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif"
  container.style.fontSize = "13px"
  container.style.color = "#111"
  container.style.background = "#fff"
  container.style.padding = "40px"
  container.style.boxSizing = "border-box"
  document.body.appendChild(container)

  // 全注文を集約してアイテム行を構築
  const allRows: {
    orderId: string
    orderDate: string
    name: string
    size: string
    color: string
    quantity: string
    unitPrice: number
    total: number
  }[] = []

  for (const order of orders) {
    const items: OrderItem[] = Array.isArray(order.items)
      ? order.items
      : typeof order.items === "string"
      ? order.items.split("\n").map((line: string) => ({ name: line }))
      : []

    for (const item of items) {
      if (!item.name) continue
      const size = item.size && item.size !== "-" ? item.size : ""
      const color = item.color && item.color !== "-" ? item.color : ""
      const qty = item.quantity || "1"
      const qtyNum = Number(qty) || 1
      const total = calcItemPrice(item.name, size, qty, storeName)
      const unitPrice = qtyNum > 0 && total > 0 ? Math.round(total / qtyNum) : 0

      allRows.push({
        orderId: order.orderId,
        orderDate: order.orderDate,
        name: item.name,
        size,
        color,
        quantity: qty,
        unitPrice,
        total,
      })
    }
  }

  const grandTotal = allRows.reduce((s, r) => s + r.total, 0)
  const tax = Math.floor(grandTotal * 0.1)
  const grandTotalWithTax = grandTotal + tax

  const fmt = (n: number) => n.toLocaleString("ja-JP")

  // HTML を生成
  container.innerHTML = `
    <div style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; color: #111; background: #fff; padding: 40px; width: 714px; box-sizing: border-box;">
      <!-- ヘッダー -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1a56db;">
        <div>
          <div style="font-size: 26px; font-weight: 700; color: #1a56db; letter-spacing: 0.04em;">領収書</div>
          <div style="font-size: 13px; color: #555; margin-top: 4px;">${monthLabel} 発注分</div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #444; line-height: 1.6;">
          <div style="font-weight: 600; font-size: 14px;">SPLASH BROTHERS CO., LTD.</div>
          <div>発行日: ${new Date().toLocaleDateString("ja-JP")}</div>
        </div>
      </div>

      <!-- 宛先 -->
      <div style="margin-bottom: 28px;">
        <div style="font-size: 18px; font-weight: 600;">${storeName} 御中</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">発注件数: ${orders.length}件</div>
      </div>

      <!-- 合計金額ハイライト -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 14px; font-weight: 600; color: #1e40af;">合計金額（税込）</div>
        <div style="font-size: 22px; font-weight: 700; color: #1e40af;">¥${fmt(grandTotalWithTax)}</div>
      </div>

      <!-- 明細テーブル -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #1a56db; color: #fff;">
            <th style="padding: 8px 6px; text-align: left; border: 1px solid #1a56db; width: 14%;">発注番号</th>
            <th style="padding: 8px 6px; text-align: left; border: 1px solid #1a56db; width: 12%;">発注日</th>
            <th style="padding: 8px 6px; text-align: left; border: 1px solid #1a56db; width: 28%;">商品名</th>
            <th style="padding: 8px 6px; text-align: left; border: 1px solid #1a56db; width: 8%;">サイズ</th>
            <th style="padding: 8px 6px; text-align: left; border: 1px solid #1a56db; width: 8%;">カラー</th>
            <th style="padding: 8px 6px; text-align: center; border: 1px solid #1a56db; width: 8%;">数量</th>
            <th style="padding: 8px 6px; text-align: right; border: 1px solid #1a56db; width: 11%;">単価</th>
            <th style="padding: 8px 6px; text-align: right; border: 1px solid #1a56db; width: 11%;">金額</th>
          </tr>
        </thead>
        <tbody>
          ${allRows
            .map(
              (row, i) => `
            <tr style="background: ${i % 2 === 0 ? "#fff" : "#f8fafc"};">
              <td style="padding: 6px; border: 1px solid #e2e8f0; font-size: 10px; font-family: monospace;">${row.orderId}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; font-size: 10px;">${row.orderDate.slice(0, 10)}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;">${row.name}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;">${row.size || "-"}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0;">${row.color || "-"}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${row.quantity}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">${row.unitPrice > 0 ? "¥" + fmt(row.unitPrice) : "-"}</td>
              <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right; font-weight: 500;">${row.total > 0 ? "¥" + fmt(row.total) : "-"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <!-- 集計 -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
        <table style="font-size: 13px; border-collapse: collapse; min-width: 280px;">
          <tr>
            <td style="padding: 6px 12px; text-align: right; color: #555;">小計（税抜）</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: 500; min-width: 100px;">¥${fmt(grandTotal)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; text-align: right; color: #555;">消費税（10%）</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: 500;">¥${fmt(tax)}</td>
          </tr>
          <tr style="border-top: 2px solid #1a56db;">
            <td style="padding: 8px 12px; text-align: right; font-weight: 700; font-size: 14px; color: #1e40af;">合計（税込）</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #1e40af;">¥${fmt(grandTotalWithTax)}</td>
          </tr>
        </table>
      </div>

      <!-- フッター -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #888; text-align: center;">
        <div>SPLASH BROTHERS CO., LTD. &nbsp;|&nbsp; info@splashbrothers.co.jp</div>
        <div style="margin-top: 4px;">※ 価格はすべて税抜表示です。合計欄のみ税込金額を表示しています。</div>
      </div>
    </div>
  `

  // html2canvas で Canvas に変換
  const { default: html2canvas } = await import("html2canvas")

  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  })

  document.body.removeChild(container)

  const imgData = canvas.toDataURL("image/png")

  // A4 サイズに合わせて PDF に追加
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const filename = `領収書_${storeName}_${monthLabel}.pdf`
  pdf.save(filename)
}
