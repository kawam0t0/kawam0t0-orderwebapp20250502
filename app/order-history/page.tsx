"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Package, ShoppingCart } from "lucide-react"

type OrderItem = {
  name: string
  size: string
  color: string
  quantity: string
}

type Order = {
  orderNumber: string
  orderDate: string
  orderTime: string
  items: OrderItem[]
  status: string
  shippingDate?: string
}

export default function OrderHistoryPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // 両方のシートからデータを取得
        const [regularResponse, hirockResponse] = await Promise.all([
          fetch("/api/sheets?sheet=Order_history"),
          fetch("/api/sheets?sheet=hirock_item_history"),
        ])

        let regularData = []
        let hirockData = []

        if (regularResponse.ok) {
          regularData = await regularResponse.json()
        } else {
          console.error("Failed to fetch regular orders")
        }

        if (hirockResponse.ok) {
          hirockData = await hirockResponse.json()
        } else {
          console.error("Failed to fetch hirock orders")
        }

        // 両方のデータを結合
        const combinedData = [...regularData, ...hirockData] as Order[]

        // 発注番号ごとにグループ化
        const orderMap = new Map<string, Order>()

        combinedData.forEach((order) => {
          const orderNumber = order.orderNumber

          if (!orderMap.has(orderNumber)) {
            // 新しい発注番号の場合、マップに追加
            orderMap.set(orderNumber, {
              orderNumber,
              orderDate: order.orderDate,
              orderTime: order.orderTime,
              items: [...order.items],
              status: order.status,
              shippingDate: order.shippingDate,
            })
          } else {
            // 既存の発注番号の場合、アイテムを追加
            const existingOrder = orderMap.get(orderNumber)!
            existingOrder.items = [...existingOrder.items, ...order.items]

            // ステータスが「出荷済み」の場合は優先
            if (order.status === "出荷済み") {
              existingOrder.status = "出荷済み"
              existingOrder.shippingDate = order.shippingDate
            }
          }
        })

        // マップから配列に変換
        const mergedOrders = Array.from(orderMap.values())

        // 日付でソートする（降順 - 最新のものが上に来るように）
        const sortedOrders = [...mergedOrders].sort((a, b) => {
          // 日付と時間を結合して比較
          const dateA = new Date(`${a.orderDate} ${a.orderTime}`)
          const dateB = new Date(`${b.orderDate} ${b.orderTime}`)
          return dateB.getTime() - dateA.getTime() // 降順
        })

        setOrders(sortedOrders)
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      // 日付と時間を解析
      const [year, month, day] = dateStr.split("/").map(Number)
      const [hour, minute] = timeStr.split(":").map(Number)

      const date = new Date(year, month - 1, day, hour, minute)

      // 日付をフォーマット
      return format(date, "yyyy年MM月dd日(EEE) HH:mm", { locale: ja })
    } catch (e) {
      return `${dateStr} ${timeStr}`
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "処理中":
        return "bg-blue-100 text-blue-800"
      case "出荷済み":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string, shippingDate?: string) => {
    if (status === "出荷済み" && shippingDate) {
      try {
        const date = parseISO(shippingDate)
        return `${status} (${format(date, "yyyy/MM/dd")})`
      } catch (e) {
        return `${status} (${shippingDate})`
      }
    }
    return status
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-500" />
              発注履歴
            </h1>
            <Button variant="outline" onClick={() => router.push("/products")} className="text-sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              商品一覧に戻る
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">発注履歴がありません</h2>
            <p className="text-gray-500 mb-6">まだ発注履歴がありません。商品を注文してみましょう。</p>
            <Button onClick={() => router.push("/products")}>商品を見る</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.orderNumber} className="overflow-hidden">
                <CardHeader className="bg-gray-50 pb-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-lg font-medium">発注番号: {order.orderNumber}</CardTitle>
                    <div className="flex items-center mt-2 md:mt-0">
                      <span className="text-sm text-gray-500 mr-3">
                        {formatDateTime(order.orderDate, order.orderTime)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                      >
                        {getStatusText(order.status, order.shippingDate)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-2 py-2 text-left font-medium text-gray-500">商品名</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-500">サイズ</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-500">カラー</th>
                          <th className="px-2 py-2 text-center font-medium text-gray-500">数量</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {order.items.map((item, index) => (
                          <tr key={`${order.orderNumber}-${index}`} className="hover:bg-gray-50">
                            <td className="px-2 py-3 text-gray-900">{item.name}</td>
                            <td className="px-2 py-3 text-center text-gray-700">{item.size || "-"}</td>
                            <td className="px-2 py-3 text-center text-gray-700">{item.color || "-"}</td>
                            <td className="px-2 py-3 text-center text-gray-700">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
