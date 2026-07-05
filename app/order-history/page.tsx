"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { ArrowLeft, Download, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { generateReceiptPDF, type OrderRecord } from "@/components/order-receipt-pdf"

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [storeInfo, setStoreInfo] = useState<{ name: string; email: string } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>("all")

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

        // 店舗情報でフィルタリング
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

  // 月一覧を生成（発注日から）
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    orders.forEach((order) => {
      try {
        const d = new Date(order.orderDate)
        if (!isNaN(d.getTime())) {
          monthSet.add(format(d, "yyyy-MM"))
        }
      } catch {}
    })
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a))
  }, [orders])

  // 月でフィルタリングされた発注一覧
  const filteredOrders = useMemo(() => {
    if (selectedMonth === "all") return orders
    return orders.filter((order) => {
      try {
        const d = new Date(order.orderDate)
        return format(d, "yyyy-MM") === selectedMonth
      } catch {
        return false
      }
    })
  }, [orders, selectedMonth])

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

  const handleDownloadPDF = async () => {
    if (!storeInfo || filteredOrders.length === 0) return
    setIsGeneratingPDF(true)
    try {
      const records: OrderRecord[] = filteredOrders.map((o) => ({
        orderId: o.orderId,
        orderDate: o.orderDate,
        storeName: o.storeName,
        items: o.items,
      }))

      const monthLabel =
        selectedMonth === "all"
          ? "全期間"
          : format(new Date(selectedMonth + "-01"), "yyyy年MM月", { locale: ja })

      await generateReceiptPDF(records, storeInfo.name, monthLabel)
    } catch (error) {
      console.error("PDF generation error:", error)
      alert("PDF の生成中にエラーが発生しました。")
    } finally {
      setIsGeneratingPDF(false)
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
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

        {/* フィルター & PDF ダウンロード */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <FileText className="h-5 w-5 text-gray-500 shrink-0" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">対象月:</span>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="月を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全期間</SelectItem>
                      {availableMonths.map((m) => (
                        <SelectItem key={m} value={m}>
                          {format(new Date(m + "-01"), "yyyy年MM月", { locale: ja })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-gray-500">
                  {filteredOrders.length}件
                </span>
              </div>
              <Button
                onClick={handleDownloadPDF}
                disabled={filteredOrders.length === 0 || isGeneratingPDF}
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
              >
                {isGeneratingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    領収書 PDF ダウンロード
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {selectedMonth === "all" ? "発注履歴がありません" : "該当する発注はありません"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedMonth === "all"
                  ? `全期間の発注 (${filteredOrders.length}件)`
                  : `${format(new Date(selectedMonth + "-01"), "yyyy年MM月", { locale: ja })} の発注 (${filteredOrders.length}件)`}
              </CardTitle>
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
                    {filteredOrders.map((order, index) => (
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
