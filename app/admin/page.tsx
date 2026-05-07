"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Package, LogOut, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO, isValid } from "date-fns"
import { ja } from "date-fns/locale"
import { CategoryTabs } from "./category-tabs"

const EXCLUDED_ITEMS = [
  "スプシャン",
  "スプワックス",
  "スプコート",
  "セラミック",
  "スプタイヤ",
  "マイクロファイバー",
  "ピッカークロス",
  
]

type OrderItem = {
  name: string
  size: string
  color: string
  quantity: string
  imageUrl?: string
}

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
  sourceSheet: string
  notes?: string
}

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
  imageUrl?: string
}

const safeParseISO = (dateString: string | null | undefined) => {
  if (!dateString) return null

  try {
    const date = parseISO(dateString)
    return isValid(date) ? date : null
  } catch (e) {
    console.error("Invalid date format:", dateString)
    return null
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "処理中":
      return "bg-blue-100 text-blue-800"
    case "対応中":
      return "bg-yellow-100 text-yellow-800"
    case "出荷済み":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function AdminPage() {
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("すべて")
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categories = ["すべて"]

  const notesTimersRef = useRef<{ [orderNumber: string]: ReturnType<typeof setTimeout> }>({})

  const fetchAvailableItems = async () => {
    try {
      const response = await fetch("/api/sheets?sheet=Available_items")

      if (response.status === 429) {
        setError("APIの利用制限に達しました。しばらく待ってから再度お試しください。")
        return
      }

      if (response.ok) {
        const data = await response.json()
        setAvailableItems(data)
        console.log("Available items loaded:", data.length)
      } else {
        console.error("Failed to fetch available items")
      }
    } catch (error) {
      console.error("Error fetching available items:", error)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/sheets?sheet=hirock_item_history")

      if (response.status === 429) {
        setError("APIの利用制限に達しました。しばらく待ってから再度お試しください。")
        setLoading(false)
        return
      }

      if (!response.ok) {
        console.error("Failed to fetch orders")
        setError("注文データの取得に失敗しました。")
        setLoading(false)
        return
      }

      const orderData = await response.json()

      const orderMap = new Map<string, Order>()

      orderData.forEach((order: Order) => {
        const orderNumber = order.orderNumber

        if (!orderMap.has(orderNumber)) {
          orderMap.set(orderNumber, {
            ...order,
            id: Math.random(),
            notes: order.notes || "",
          })
        } else {
          const existingOrder = orderMap.get(orderNumber)!
          existingOrder.items = [...existingOrder.items, ...order.items]
        }
      })

      const mergedOrders = Array.from(orderMap.values())

      const filteredOrders = mergedOrders
        .map((order) => {
          const filteredItems = order.items.filter(
            (item) => !EXCLUDED_ITEMS.some((excludedItem) => item.name.includes(excludedItem)),
          )

          return {
            ...order,
            items: filteredItems,
          }
        })
        .filter((order) => order.items.length > 0)

      const sortedOrders = [...filteredOrders].sort((a, b) => {
        const dateA = new Date(`${a.orderDate} ${a.orderTime}`)
        const dateB = new Date(`${b.orderDate} ${b.orderTime}`)
        return dateB.getTime() - dateA.getTime()
      })

      setOrders(sortedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("注文データの取得中にエラーが発生しました。")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableItems()
    fetchOrders()

    return () => {
      Object.values(notesTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split("/").map(Number)
      const [hour, minute] = timeStr.split(":").map(Number)

      const date = new Date(year, month - 1, day, hour, minute)

      return format(date, "yyyy年MM月dd日(EEE) HH:mm", { locale: ja })
    } catch (e) {
      return `${dateStr} ${timeStr}`
    }
  }

  const updateOrderNotes = (orderNumber: string, notes: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => (order.orderNumber === orderNumber ? { ...order, notes } : order)),
    )

    if (notesTimersRef.current[orderNumber]) {
      clearTimeout(notesTimersRef.current[orderNumber])
    }

    notesTimersRef.current[orderNumber] = setTimeout(async () => {
      try {
        const response = await fetch("/api/update-order-notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderNumber, notes }),
        })

        if (response.status === 429) {
          alert("APIの利用制限に達しました。しばらく待ってから再度お試しください。")
          return
        }

        if (!response.ok) {
          throw new Error("Failed to update notes")
        }

        console.log(`Notes updated for order ${orderNumber}`)
      } catch (error) {
        console.error("Error updating notes:", error)
        alert("備考の保存に失敗しました。もう一度お試しください。")
      }
    }, 1000)
  }

  const filteredOrders = statusFilter ? orders.filter((order) => order.status === statusFilter) : orders

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-500" />
              <h1 className="text-xl font-bold text-gray-900">SPLASH'N'GO! 管理者ダッシュボード</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex space-x-2">
                <Button
                  variant={statusFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(null)}
                  className={statusFilter === null ? "bg-blue-600 text-white" : ""}
                >
                  すべて
                </Button>

                <Button
                  variant={statusFilter === "処理中" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("処理中")}
                  className={statusFilter === "処理中" ? "bg-blue-600 text-white" : ""}
                >
                  処理中
                </Button>

                <Button
                  variant={statusFilter === "対応中" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("対応中")}
                  className={statusFilter === "対応中" ? "bg-blue-600 text-white" : ""}
                >
                  対応中
                </Button>

                <Button
                  variant={statusFilter === "出荷済み" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("出荷済み")}
                  className={statusFilter === "出荷済み" ? "bg-blue-600 text-white" : ""}
                >
                  出荷済み
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("storeInfo")
                  router.push("/login")
                }}
                className="text-sm"
              >
                <LogOut className="h-4 w-4 mr-1" />
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <p className="text-red-800 font-medium">エラーが発生しました</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Button
                onClick={() => {
                  setError(null)
                  fetchOrders()
                }}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                再試行
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">発注履歴がありません</h2>
            <p className="text-gray-500 mb-6">まだ発注履歴がありません。</p>
            <Button
              onClick={() => {
                localStorage.removeItem("storeInfo")
                router.push("/login")
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        ) : (
          <>
            <CategoryTabs categories={categories} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

            <div className="mt-8">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">発注履歴一覧</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          発注番号
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          発注日時
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          店舗名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          商品
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          出荷日
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ステータス
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          備考
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map((order) => (
                        <tr key={order.orderNumber}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(order.orderDate, order.orderTime)}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.storeName}</td>

                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx}>
                                  {item.name} {item.color && `(${item.color})`} {item.size && `[${item.size}]`} ×{" "}
                                  {item.quantity}
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="date"
                              value={order.shippingDate || ""}
                              onChange={async (e) => {
                                const newDate = e.target.value

                                setOrders((prev) =>
                                  prev.map((o) =>
                                    o.orderNumber === order.orderNumber ? { ...o, shippingDate: newDate } : o,
                                  ),
                                )

                                try {
                                  const response = await fetch("/api/update-shipping-date", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      orderNumber: order.orderNumber,
                                      shippingDate: newDate,
                                      sheetName: "hirock_item_history",
                                    }),
                                  })

                                  if (response.status === 429) {
                                    alert("APIの利用制限に達しました。しばらく待ってから再度お試しください。")
                                    setOrders((prev) =>
                                      prev.map((o) =>
                                        o.orderNumber === order.orderNumber
                                          ? { ...o, shippingDate: order.shippingDate }
                                          : o,
                                      ),
                                    )
                                    return
                                  }

                                  if (!response.ok) {
                                    throw new Error("Failed to update shipping date")
                                  }
                                } catch (error) {
                                  console.error("Error updating shipping date:", error)
                                  setOrders((prev) =>
                                    prev.map((o) =>
                                      o.orderNumber === order.orderNumber ? { ...o, shippingDate: order.shippingDate } : o,
                                    ),
                                  )
                                }
                              }}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={order.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value
                                const oldStatus = order.status

                                setOrders((prev) =>
                                  prev.map((o) =>
                                    o.orderNumber === order.orderNumber ? { ...o, status: newStatus } : o,
                                  ),
                                )

                                try {
                                  const response = await fetch("/api/update-order-status", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      orderNumber: order.orderNumber,
                                      newStatus,
                                      sheetName: "hirock_item_history",
                                    }),
                                  })

                                  if (response.status === 429) {
                                    alert("APIの利用制限に達しました。しばらく待ってから再度お試しください。")
                                    setOrders((prev) =>
                                      prev.map((o) =>
                                        o.orderNumber === order.orderNumber ? { ...o, status: oldStatus } : o,
                                      ),
                                    )
                                    return
                                  }

                                  if (!response.ok) {
                                    throw new Error("Failed to update status")
                                  }
                                } catch (error) {
                                  console.error("Error updating status:", error)
                                  setOrders((prev) =>
                                    prev.map((o) =>
                                      o.orderNumber === order.orderNumber ? { ...o, status: oldStatus } : o,
                                    ),
                                  )
                                }
                              }}
                              className={`px-2 py-1 rounded text-sm ${getStatusColor(order.status)}`}
                            >
                              <option value="処理中">処理中</option>
                              <option value="対応中">対応中</option>
                              <option value="出荷済み">出荷済み</option>
                            </select>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-500">
                            <textarea
                              value={order.notes || ""}
                              onChange={(e) => updateOrderNotes(order.orderNumber, e.target.value)}
                              placeholder="備考を入力..."
                              className="w-full min-w-[200px] h-20 border border-gray-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}