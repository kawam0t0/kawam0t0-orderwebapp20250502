"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
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

  // ステータス変更ハンドラー
  const handleStatusChange = (orderNumber: string, newStatus: string) => {
    setOrderStates((prev) => ({
      ...prev,
      [orderNumber]: {
        ...prev[orderNumber],
        status: newStatus,
      },
    }))

    // 出荷済みの場合は出荷日も必要
    if (newStatus === "出荷済み") {
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
      // 出荷済み以外のステータスの場合は直接更新
      updateOrderStatus(orderNumber, newStatus)
    }
  }

  // 出荷日変更ハンドラー
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

    // APIを呼び出して出荷日を更新
    updateOrderStatus(orderNumber, "出荷済み", format(date, "yyyy-MM-dd"))
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

                  {/* 出荷日選択（出荷済みの場合のみ表示） */}
                  {orderState.status === "出荷済み" && (
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
                      <td className="py-3 px-4 text-gray-900">{item.name}</td>
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
