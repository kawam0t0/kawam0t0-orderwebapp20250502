"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// 注文アイテムの型定義
type OrderItem = {
  name: string
  size: string
  color: string
  quantity: string
  imageUrl?: string // 画像URLを追加
}

// 注文の型定義
type Order = {
  id: number
  orderNumber: string
  orderDate: string
  orderTime: string
  storeName: string
  email: string
  items: OrderItem[]
  status: string
  shippingDate?: string | null
}

// 商品情報の型定義
type AvailableItem = {
  id: string
  category: string
  name: string
  colors?: string[]
  sizes?: string[]
  amounts?: number[]
  prices?: string[]
  pricesPerPiece?: string[]
  leadTime: string
  partnerName?: string
  imageUrl?: string // 画像URLを追加
}

// デフォルトの画像プレースホルダーURL
const DEFAULT_PLACEHOLDER_URL = "/diverse-products-still-life.png"

// Google DriveのURLを直接表示可能な形式に変換する関数
const convertGoogleDriveUrl = (url: string): string => {
  try {
    if (!url) return DEFAULT_PLACEHOLDER_URL

    // URLが空文字列または無効な場合はプレースホルダーを返す
    if (url.trim() === "") return DEFAULT_PLACEHOLDER_URL

    // Google DriveのURLかどうかを確認（view形式）
    if (url.includes("drive.google.com/file/d/")) {
      // ファイルIDを抽出
      const fileIdMatch = url.match(/\/d\/([^/]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        // 直接表示可能なURLに変換
        return `https://drive.google.com/uc?export=view&id=${fileId}`
      }
    }

    // URLが既に変換済みかチェック
    if (url.includes("drive.google.com/uc?export=view&id=")) {
      return url
    }

    // その他の有効なURLはそのまま返す
    return url
  } catch (error) {
    console.error("Error converting Google Drive URL:", error)
    return DEFAULT_PLACEHOLDER_URL
  }
}

// 商品画像の取得関数
const getProductImage = (item: OrderItem, availableItems: AvailableItem[]): string => {
  // 商品に画像URLがある場合はそれを使用
  if (item.imageUrl && item.imageUrl.trim() !== "") {
    return item.imageUrl
  }

  // 商品名と選択された色に基づいて一致する商品を検索
  if (item.color) {
    // 同じ商品名と選択された色の商品バリアントを検索
    const colorVariants = availableItems.filter(
      (product) =>
        product.name === item.name &&
        product.colors?.includes(item.color) &&
        product.imageUrl &&
        product.imageUrl.trim() !== "",
    )

    if (colorVariants.length > 0) {
      // 最初に見つかった一致するバリエーションを使用
      const bestMatch = colorVariants[0]
      return convertGoogleDriveUrl(bestMatch.imageUrl || "")
    }
  }

  // 商品名で一致する商品を検索（色が一致しない場合のフォールバック）
  const matchingProduct = availableItems.find((product) => product.name === item.name)
  if (matchingProduct && matchingProduct.imageUrl && matchingProduct.imageUrl.trim() !== "") {
    return convertGoogleDriveUrl(matchingProduct.imageUrl)
  }

  // 画像URLがない場合はプレースホルダーを使用
  return DEFAULT_PLACEHOLDER_URL
}

interface CategoryOrdersProps {
  orders: Order[]
  category: string
  formatDateTime: (dateStr: string, timeStr: string) => string
  getStatusColor: (status: string) => string
  availableItems: AvailableItem[]
  updateOrderStatus: (orderNumber: string, newStatus: string, shippingDate?: string) => Promise<void>
}

export function CategoryOrders({
  orders,
  category,
  formatDateTime,
  getStatusColor,
  availableItems,
  updateOrderStatus,
}: CategoryOrdersProps) {
  // 注文ごとの状態を管理
  const [orderStates, setOrderStates] = useState<{
    [orderNumber: string]: {
      status: string
      shippingDate: Date | undefined
      isCalendarOpen: boolean
    }
  }>(() => {
    // 初期状態を設定
    const initialStates: {
      [orderNumber: string]: {
        status: string
        shippingDate: Date | undefined
        isCalendarOpen: boolean
      }
    } = {}

    orders.forEach((order) => {
      initialStates[order.orderNumber] = {
        status: order.status,
        shippingDate: order.shippingDate ? new Date(order.shippingDate) : undefined,
        isCalendarOpen: false,
      }
    })

    return initialStates
  })

  // ステータス変更ハンドラーを修正
  const handleStatusChange = (orderNumber: string, newStatus: string) => {
    setOrderStates((prev) => ({
      ...prev,
      [orderNumber]: {
        ...prev[orderNumber],
        status: newStatus,
      },
    }))

    // 対応中または出荷済みの場合は出荷日も必要
    if (newStatus === "対応中" || newStatus === "出荷済み") {
      // 出荷日が既に設定されている場合は更新
      if (orderStates[orderNumber]?.shippingDate) {
        updateOrderStatus(orderNumber, newStatus, format(orderStates[orderNumber].shippingDate, "yyyy-MM-dd"))
      }
      // そうでない場合はカレンダーを開く
      else {
        setOrderStates((prev) => ({
          ...prev,
          [orderNumber]: {
            ...prev[orderNumber],
            isCalendarOpen: true,
          },
        }))
      }
    } else {
      // 処理中のステータスの場合は直接更新
      updateOrderStatus(orderNumber, newStatus)
    }
  }

  // 出荷日変更ハンドラーを修正
  const handleShippingDateChange = (orderNumber: string, date: Date | undefined) => {
    if (!date) return

    setOrderStates((prev) => ({
      ...prev,
      [orderNumber]: {
        ...prev[orderNumber],
        shippingDate: date,
        isCalendarOpen: false,
      },
    }))

    // 現在のステータスを取得
    const currentStatus = orderStates[orderNumber]?.status || "処理中"

    // APIを呼び出して出荷日を更新（対応中または出荷済みの場合）
    if (currentStatus === "対応中" || currentStatus === "出荷済み") {
      updateOrderStatus(orderNumber, currentStatus, format(date, "yyyy-MM-dd"))
    }
  }

  // すべてのアイテムを返す
  const getCategoryItems = (order: Order, category: string): OrderItem[] => {
    return order.items
  }

  return (
    <div className="space-y-6 p-6">
      {orders.map((order) => {
        // 注文内のすべてのアイテムを取得
        const categoryItems = getCategoryItems(order, category)

        // アイテムがない場合はスキップ
        if (categoryItems.length === 0) return null

        // この注文の現在の状態を取得
        const orderState = orderStates[order.orderNumber] || {
          status: order.status,
          shippingDate: order.shippingDate ? new Date(order.shippingDate) : undefined,
          isCalendarOpen: false,
        }

        return (
          <div key={order.orderNumber} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 注文ヘッダー - 発注番号と日時、ステータス */}
            <div className="flex justify-between items-center p-4">
              <div>
                <h3 className="text-base font-medium">発注番号: {order.orderNumber}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">{formatDateTime(order.orderDate, order.orderTime)}</span>

                {/* ステータス選択プルダウン */}
                <div className="flex items-center gap-2">
                  <Select
                    value={orderState.status}
                    onValueChange={(value) => handleStatusChange(order.orderNumber, value)}
                  >
                    <SelectTrigger className={`w-24 h-8 text-xs ${getStatusColor(orderState.status)}`}>
                      <SelectValue placeholder="ステータス" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="処理中">処理中</SelectItem>
                      <SelectItem value="対応中">対応中</SelectItem>
                      <SelectItem value="出荷済み">出荷済み</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 出荷日選択（対応中または出荷済みの場合のみ表示） */}
                  {(orderState.status === "対応中" || orderState.status === "出荷済み") && (
                    <Popover
                      open={orderState.isCalendarOpen}
                      onOpenChange={(open) =>
                        setOrderStates((prev) => ({
                          ...prev,
                          [order.orderNumber]: {
                            ...prev[order.orderNumber],
                            isCalendarOpen: open,
                          },
                        }))
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-8 text-xs ${orderState.shippingDate ? "text-gray-900" : "text-gray-400"}`}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {orderState.shippingDate
                            ? format(orderState.shippingDate, "yyyy/MM/dd", { locale: ja })
                            : "出荷日を選択"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={orderState.shippingDate}
                          onSelect={(date) => handleShippingDateChange(order.orderNumber, date)}
                          initialFocus
                          locale={ja}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </div>

            {/* 注文アイテムテーブル */}
            <div className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-white">
                  <tr className="border-t border-gray-200">
                    <th className="py-2 px-4 text-left font-medium text-gray-500">商品名</th>
                    <th className="py-2 px-4 text-center font-medium text-gray-500">サイズ</th>
                    <th className="py-2 px-4 text-center font-medium text-gray-500">カラー</th>
                    <th className="py-2 px-4 text-center font-medium text-gray-500">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map((item, index) => (
                    <tr key={`${order.orderNumber}-${index}`} className="border-t border-gray-100">
                      <td className="py-3 px-4 text-gray-900">
                        <div className="flex items-center">
                          {/* 商品画像を追加 */}
                          <div className="relative h-10 w-10 mr-3 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                            <Image
                              src={getProductImage(item, availableItems) || "/placeholder.svg"}
                              alt={item.name}
                              fill
                              className="object-contain"
                              sizes="40px"
                              onError={(e) => {
                                console.error(`Error loading image for ${item.name}, using placeholder`)
                                e.currentTarget.src = DEFAULT_PLACEHOLDER_URL
                              }}
                            />
                          </div>
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">{item.size || "-"}</td>
                      <td className="py-3 px-4 text-center text-gray-700">{item.color || "-"}</td>
                      <td className="py-3 px-4 text-center text-gray-700">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
