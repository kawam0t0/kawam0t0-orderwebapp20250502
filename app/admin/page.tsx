"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Package, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO, isValid } from "date-fns"
import { ja } from "date-fns/locale"
import { CategoryTabs } from "./category-tabs"
import { CategoryOrders } from "./category-orders"

// 除外するアイテムリスト
const EXCLUDED_ITEMS = [
  "スプシャン",
  "スプワックス",
  "スプコート",
  "セラミック",
  "スプタイヤ",
  "マイクロファイバー",
  "ピッカークロス",
]

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

// 日付を安全に解析する関数
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

// ステータスに応じた色を返す関数
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
  const categories = ["すべて"]
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  // 商品データを取得する関数
  const fetchAvailableItems = async () => {
    try {
      const response = await fetch("/api/sheets?sheet=Available_items")
      if (response.ok) {
        const data = await response.json()
        setAvailableItems(data)
      } else {
        console.error("Failed to fetch available items")
      }
    } catch (error) {
      console.error("Error fetching available items:", error)
    }
  }

  // 注文データを取得する関数 - 両方のシートからデータを取得
  const fetchOrders = async () => {
    setLoading(true)
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
            ...order,
            id: Math.random(),
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

      // 各注文から除外アイテムをフィルタリング
      const filteredOrders = mergedOrders
        .map((order) => {
          // 除外アイテム以外のアイテムだけをフィルタリング
          const filteredItems = order.items.filter(
            (item) => !EXCLUDED_ITEMS.some((excludedItem) => item.name.includes(excludedItem)),
          )

          // フィルタリングされたアイテムで注文を更新
          return {
            ...order,
            items: filteredItems,
          }
        })
        .filter((order) => order.items.length > 0) // アイテムが0になった注文は除外

      // 日付でソートする（降順 - 最新のものが上に来るように）
      const sortedOrders = [...filteredOrders].sort((a, b) => {
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

  // 初回レンダリング時にデータを取得
  useEffect(() => {
    fetchAvailableItems()
    fetchOrders()
  }, [])

  // 日付をフォーマットする関数
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

  // 注文ステータスを更新する関数
  const updateOrderStatus = async (orderNumber: string, newStatus: string, shippingDate?: string) => {
    try {
      // ステータスを更新
      const statusResponse = await fetch("/api/update-order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderNumber, newStatus }),
      })

      if (!statusResponse.ok) {
        throw new Error("Failed to update order status")
      }

      // 出荷日を更新（出荷済みの場合のみ）
      if (newStatus === "出荷済み" && shippingDate) {
        const shippingResponse = await fetch("/api/update-shipping-date", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderNumber, shippingDate }),
        })

        if (!shippingResponse.ok) {
          throw new Error("Failed to update shipping date")
        }
      }

      // 注文データを再取得
      fetchOrders()
    } catch (error) {
      console.error("Error updating order:", error)
      alert("注文の更新に失敗しました。")
    }
  }

  // ステータスフィルターを適用
  const filteredOrders = statusFilter ? orders.filter((order) => order.status === statusFilter) : orders

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
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
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">発注履歴がありません</h2>
            <p className="text-gray-500 mb-6">まだ発注履歴がありません。商品を注文してみましょう。</p>
            <Button onClick={() => router.push("/products")}>商品を見る</Button>
          </div>
        ) : (
          <>
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />

            {/* カテゴリー別表示 */}
            <CategoryOrders
              orders={filteredOrders}
              category={activeCategory}
              formatDateTime={formatDateTime}
              getStatusColor={getStatusColor}
              availableItems={availableItems}
              updateOrderStatus={updateOrderStatus}
            />
          </>
        )}
      </main>
    </div>
  )
}
