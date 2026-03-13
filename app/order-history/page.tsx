"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"

interface OrderItem {
  name: string
  size: string
  color: string
  quantity: string
}

interface Order {
  id: string
  orderNumber: string
  orderDate: string
  orderTime: string
  storeName: string
  email: string
  items: OrderItem[]
  status: string
  shippingDate: string | null
  sourceSheet: string
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storeInfo, setStoreInfo] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // ローカルストレージから店舗情報を取得
    const storedStoreInfo = localStorage.getItem("storeInfo")
    if (storedStoreInfo) {
      const parsedStoreInfo = JSON.parse(storedStoreInfo)
      setStoreInfo(parsedStoreInfo)
      console.log("Store info loaded:", parsedStoreInfo)
    } else {
      setError("店舗情報が見つかりません。再度ログインしてください。")
      setLoading(false)
      return
    }
  }, [])

  useEffect(() => {
    if (!storeInfo) return

    const fetchOrders = async () => {
      setLoading(true)
      setError(null)
      try {
        console.log("Fetching orders for store:", storeInfo.name)

        // hirock_item_historyシートから注文履歴を取得
        const hirockResponse = await fetch("/api/sheets?sheet=hirock_item_history")
        let hirockOrders: Order[] = []

        if (hirockResponse.ok) {
          const hirockData = await hirockResponse.json()
          console.log("Hirock data received:", hirockData.length, "orders")

          // 該当店舗の注文のみをフィルタリング
          hirockOrders = hirockData.filter((order: Order) => {
            const matches = order.storeName === storeInfo.name || order.email === storeInfo.email
            if (matches) {
              console.log("Matched hirock order:", order.orderNumber, "for store:", order.storeName)
            }
            return matches
          })
        } else {
          console.warn("Failed to fetch hirock_item_history:", hirockResponse.status)
        }

        // Order_historyシートから注文履歴を取得
        const orderResponse = await fetch("/api/sheets?sheet=Order_history")
        let orderHistoryOrders: Order[] = []

        if (orderResponse.ok) {
          const orderData = await orderResponse.json()
          console.log("Order history data received:", orderData.length, "orders")

          // 該当店舗の注文のみをフィルタリング
          orderHistoryOrders = orderData.filter((order: Order) => {
            const matches = order.storeName === storeInfo.name || order.email === storeInfo.email
            if (matches) {
              console.log("Matched order history:", order.orderNumber, "for store:", order.storeName)
            }
            return matches
          })
        } else {
          console.warn("Failed to fetch Order_history:", orderResponse.status)
        }

        // 両方のシートからの注文を結合
        const allOrders = [...hirockOrders, ...orderHistoryOrders]
        console.log("Total filtered orders:", allOrders.length)

        // 発注番号でグループ化（重複を避けるため）
        const orderMap = new Map<string, Order>()
        allOrders.forEach((order) => {
          const existing = orderMap.get(order.orderNumber)
          if (!existing) {
            orderMap.set(order.orderNumber, order)
          } else {
            // より新しいステータス情報を優先
            if (order.status === "出荷済み" || order.shippingDate) {
              orderMap.set(order.orderNumber, order)
            }
          }
        })

        const uniqueOrders = Array.from(orderMap.values())

        // 日付順でソート（新しい順）
        uniqueOrders.sort((a, b) => {
          const dateA = new Date(`${a.orderDate} ${a.orderTime}`)
          const dateB = new Date(`${b.orderDate} ${a.orderTime}`)
          return dateB.getTime() - dateA.getTime()
        })

        console.log("Final orders to display:", uniqueOrders.length)
        setOrders(uniqueOrders)
      } catch (e: any) {
        console.error("Error fetching orders:", e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [storeInfo])

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">エラー: {error}</div>
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">発注履歴</h1>
          <button
            onClick={() => router.push("/products")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            発注画面に戻る
          </button>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              {storeInfo ? `${storeInfo.name}の発注履歴はありません。` : "発注履歴はありません。"}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">発注履歴</h1>
        <button
          onClick={() => router.push("/products")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          発注画面に戻る
        </button>
      </div>
      {storeInfo && (
        <div className="mb-4 text-sm text-gray-600">
          店舗: {storeInfo.name} ({storeInfo.email})
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>過去の発注 ({orders.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>発注番号</TableHead>
                <TableHead>発注日時</TableHead>
                <TableHead>商品詳細</TableHead>
                <TableHead>出荷日</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>データソース</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={`${order.orderNumber}-${order.sourceSheet}`}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>
                    {order.orderDate} {order.orderTime}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{item.name}</span>
                          {item.color && <span className="text-gray-600"> ({item.color})</span>}
                          {item.size && <span className="text-gray-600"> - {item.size}</span>}
                          <span className="text-gray-600"> × {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.shippingDate ? (
                      <span className="text-green-600">{order.shippingDate}</span>
                    ) : (
                      <span className="text-gray-400">未定</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "出荷済み"
                          ? "bg-green-100 text-green-800"
                          : order.status === "対応中"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {order.sourceSheet === "hirock_item_history" ? "新システム" : "旧システム"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
