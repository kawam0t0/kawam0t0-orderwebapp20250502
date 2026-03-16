"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type OrderItem = {
  name: string
  size?: string
  color?: string
  quantity?: string
}

type OrderHistoryItem = {
  orderId: string
  orderDate: string
  storeName: string
  storeEmail: string
  items: OrderItem[] | string
  shippingDate?: string
  status: string
  dataSource: string
}

export default function OrderHistoryPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [storeInfo, setStoreInfo] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    const savedStoreInfo = localStorage.getItem("storeInfo")
    if (!savedStoreInfo) {
      router.push("/login")
      return
    }

    let parsedInfo: { name: string; email: string } | null = null
    try {
      parsedInfo = JSON.parse(savedStoreInfo)
      setStoreInfo(parsedInfo)
    } catch (e) {
      console.error("Failed to parse store info:", e)
      router.push("/login")
      return
    }

    const fetchOrderHistory = async () => {
      try {
        setIsLoading(true)

        const [hirockResponse, regularResponse] = await Promise.all([
          fetch("/api/sheets?sheet=hirock_item_history"),
          fetch("/api/sheets?sheet=Order_history"),
        ])

        const hirockData = hirockResponse.ok ? await hirockResponse.json() : []
        const regularData = regularResponse.ok ? await regularResponse.json() : []

        const hirockOrders: OrderHistoryItem[] = hirockData.map((o: any) => ({
          orderId: o.orderNumber,
          orderDate: `${o.orderDate} ${o.orderTime}`,
          storeName: o.storeName,
          storeEmail: o.email,
          items: o.items || [],
          shippingDate: o.shippingDate,
          status: o.status || "処理中",
          dataSource: "新システム",
        }))

        const regularOrders: OrderHistoryItem[] = regularData.map((o: any) => ({
          orderId: o.orderNumber,
          orderDate: `${o.orderDate} ${o.orderTime}`,
          storeName: o.storeName,
          storeEmail: o.email,
          items: o.items || [],
          shippingDate: o.shippingDate,
          status: o.status || "処理中",
          dataSource: "旧システム",
        }))

        const allOrders = [...hirockOrders, ...regularOrders]

        // 店舗情報でフィルタリング（parsedInfoを直接使用）
        const storeOrders = allOrders.filter((order: OrderHistoryItem) => {
          const matchesStoreName = order.storeName === parsedInfo?.name
          const matchesEmail = order.storeEmail === parsedInfo?.email
          return matchesStoreName || matchesEmail
        })

        // 発注番号で重複排除（新システムを優先）
        const uniqueOrders = storeOrders.reduce((acc: OrderHistoryItem[], current: OrderHistoryItem) => {
          const existingIndex = acc.findIndex((order) => order.orderId === current.orderId)
          if (existingIndex >= 0) {
            if (current.dataSource === "新システム") {
              acc[existingIndex] = current
            }
          } else {
            acc.push(current)
          }
          return acc
        }, [])

        // 発注日で降順ソート
        uniqueOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())

        setOrders(uniqueOrders)
      } catch (error) {
        console.error("Error fetching order history:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderHistory()
  }, [router])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "出荷済み":
        return <Badge className="bg-green-100 text-green-800">出荷済み</Badge>
      case "対応中":
        return <Badge className="bg-yellow-100 text-yellow-800">対応中</Badge>
      case "処理中":
        return <Badge className="bg-blue-100 text-blue-800">処理中</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">発注履歴</h1>
            {storeInfo && (
              <p className="text-gray-600">
                店舗: {storeInfo.name} ({storeInfo.email})
              </p>
            )}
          </div>
          <Button onClick={() => router.push("/products")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            発注画面に戻る
          </Button>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500 text-lg">発注履歴がありません</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>過去の発注 ({orders.length}件)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold">発注番号</th>
                      <th className="text-left p-3 font-semibold">発注日時</th>
                      <th className="text-left p-3 font-semibold">商品詳細</th>
                      <th className="text-left p-3 font-semibold">出荷日</th>
                      <th className="text-left p-3 font-semibold">ステータス</th>
                      <th className="text-left p-3 font-semibold">データソース</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => (
                      <tr key={`${order.orderId}-${index}`} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">{order.orderId}</td>
                        <td className="p-3">{format(new Date(order.orderDate), "yyyy/MM/dd HH:mm", { locale: ja })}</td>
                        <td className="p-3">
                          <div className="max-w-md">
                            {Array.isArray(order.items)
                              ? order.items.map((item: OrderItem, i: number) => {
                                  const parts = [item.name]
                                  if (item.color && item.color !== "-") parts[0] += ` (${item.color})`
                                  if (item.size && item.size !== "-") parts[0] += ` - ${item.size}`
                                  if (item.quantity) parts[0] += ` × ${item.quantity}`
                                  return (
                                    <div key={i} className="text-sm text-gray-700 mb-1">
                                      {parts[0]}
                                    </div>
                                  )
                                })
                              : typeof order.items === "string"
                              ? order.items.split("\n").map((item: string, i: number) => (
                                  <div key={i} className="text-sm text-gray-700 mb-1">{item}</div>
                                ))
                              : null}
                          </div>
                        </td>
                        <td className="p-3">
                          {order.shippingDate ? (
                            <span className="text-green-600 font-medium">
                              {format(new Date(order.shippingDate), "yyyy-MM-dd", { locale: ja })}
                            </span>
                          ) : (
                            <span className="text-gray-400">未定</span>
                          )}
                        </td>
                        <td className="p-3">{getStatusBadge(order.status)}</td>
                        <td className="p-3">
                          <Badge variant="outline">{order.dataSource}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
