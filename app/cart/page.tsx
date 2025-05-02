"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Trash2, ArrowLeft, ShoppingBag } from "lucide-react"
import { format, addWeeks } from "date-fns"
import { ja } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

// 特定の販促グッズリストを定義
const specialPromotionalItems = [
  "ポイントカード",
  "サブスクメンバーズカード",
  "サブスクフライヤー",
  "フリーチケット",
  "クーポン券",
  "名刺",
  "のぼり",
  "お年賀(マイクロファイバークロス)",
]

// アパレル商品かどうかを判定する関数
const isApparelItem = (name: string): boolean => {
  const apparelItems = ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"]
  return apparelItems.some((item) => name.includes(item))
}

// 数量の表示方法を修正する関数
const formatQuantity = (item: CartItem) => {
  // 特定の販促グッズの場合は、数量をそのまま表示
  if (specialPromotionalItems.some((name) => item.item_name.includes(name))) {
    return `${item.quantity}枚`
  }

  // その他の商品は従来通りの処理
  return `${item.quantity}${item.item_name.includes("液剤") ? "本" : "枚"}`
}

// 商品タイプの定義
type CartItem = {
  id: string
  item_category: string
  item_name: string
  item_color?: string[]
  item_size?: string[]
  item_amount?: number | number[]
  item_price: string | string[]
  lead_time: string
  selectedColor?: string
  selectedSize?: string
  selectedQuantity?: number | string
  quantity: number
  imageUrl?: string // 画像URLを追加
}

// COMING SOON画像のURL
const COMING_SOON_IMAGE_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/0005720_coming-soon-page_550-GJuRp7f7JXrp3ZSP6hK2ihMLTP2abk.webp"

// Google DriveのURLを直接表示可能な形式に変換する関数
const convertGoogleDriveUrl = (url: string): string => {
  try {
    // Google DriveのURLかどうかを確認
    if (url && url.includes("drive.google.com/file/d/")) {
      // ファイルIDを抽出
      const fileIdMatch = url.match(/\/d\/([^/]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        // 直接表示可能なURLに変換
        return `https://drive.google.com/uc?export=view&id=${fileId}`
      }
    }
    return url
  } catch (error) {
    console.error("Error converting Google Drive URL:", error)
    return url
  }
}

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({})
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [products, setProducts] = useState<any[]>([]) // 商品データを保持するstate

  // カート情報の取得
  useEffect(() => {
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      try {
        const items = JSON.parse(savedCart)
        setCartItems(items)

        // 数量の初期化
        const initialQuantities: { [key: string]: number } = {}
        items.forEach((item: CartItem) => {
          initialQuantities[item.id] = item.quantity || 1
        })
        setQuantities(initialQuantities)
      } catch (e) {
        console.error("Failed to parse cart data:", e)
      }
    }

    // 商品データを取得して画像URLを取得
    fetchProducts()
  }, [])

  // 商品データを取得する関数
  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/sheets?sheet=Available_items")
      if (response.ok) {
        const data = await response.json()
        setProducts(data)

        // カート内の商品に画像URLを追加
        if (data && data.length > 0) {
          const savedCart = localStorage.getItem("cart")
          if (savedCart) {
            const items = JSON.parse(savedCart)
            const updatedItems = items.map((item: CartItem) => {
              // 商品名で一致する商品を検索
              const matchingProduct = data.find((product: any) => product.name === item.item_name)
              if (matchingProduct && matchingProduct.imageUrl) {
                return {
                  ...item,
                  imageUrl: convertGoogleDriveUrl(matchingProduct.imageUrl),
                }
              }
              return item
            })
            setCartItems(updatedItems)
            localStorage.setItem("cart", JSON.stringify(updatedItems))
          }
        }
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  // 数量変更の処理
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setQuantities((prev) => ({
      ...prev,
      [itemId]: newQuantity,
    }))

    // カート内の商品数量を更新
    const updatedCart = cartItems.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item))
    setCartItems(updatedCart)
    localStorage.setItem("cart", JSON.stringify(updatedCart))
  }

  // 商品の削除
  const removeItem = (itemId: string) => {
    const updatedCart = cartItems.filter((item) => item.id !== itemId)
    setCartItems(updatedCart)
    localStorage.setItem("cart", JSON.stringify(updatedCart))
  }

  // 商品価格の計算
  const calculateItemPrice = (item: CartItem) => {
    // アパレル商品の場合
    if (isApparelItem(item.item_name)) {
      const basePrice = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
      return basePrice * item.quantity
    }
    // 販促グッズの場合
    else if (item.item_category === "販促グッズ" && item.selectedQuantity) {
      const price = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
      return price // 販促グッズは選択した数量セットの価格をそのまま使用
    }
    // その他の商品の場合
    else {
      const basePrice = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
      return basePrice * item.quantity
    }
  }

  // 小計の計算
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + calculateItemPrice(item)
    }, 0)
  }

  // 税金の計算（10%）
  const calculateTax = () => {
    return calculateSubtotal() * 0.1
  }

  // 合計金額の計算（税込み）
  const calculateTotal = () => {
    // 小計に消費税を加算
    const taxInclusiveTotal = calculateSubtotal() + calculateTax()
    return taxInclusiveTotal
  }

  // 商品画像の取得
  const getProductImage = (item: CartItem) => {
    // 商品に画像URLがある場合はそれを使用
    if (item.imageUrl && item.imageUrl.trim() !== "") {
      return item.imageUrl
    }

    // 商品名で一致する商品を検索
    const matchingProduct = products.find((product) => product.name === item.item_name)
    if (matchingProduct && matchingProduct.imageUrl) {
      return convertGoogleDriveUrl(matchingProduct.imageUrl)
    }

    // カテゴリーに基づいたプレースホルダー画像を返す
    const category = item.item_category
    const name = item.item_name

    // COMING SOON画像を使用
    return COMING_SOON_IMAGE_URL
  }

  // 注文処理
  const handleCheckout = () => {
    router.push("/checkout")
  }

  // 納期の表示
  const displayDeliveryTime = (leadTime: string, category: string) => {
    // カテゴリーに基づいた納期計算
    if (category === "販促グッズ") {
      // 販促グッズは約3週間
      const deliveryDate = addWeeks(new Date(), 3)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    } else if (category === "液剤") {
      // 液剤は約3日
      const deliveryDate = new Date()
      deliveryDate.setDate(deliveryDate.getDate() + 3)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    // その他のカテゴリーは従来通りの計算
    if (leadTime === "即日") return "即日出荷"
    const weeks = Number(leadTime.match(/\d+/)?.[0] || "0")
    const deliveryDate = addWeeks(new Date(), weeks)
    return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
  }

  // 単位を取得する関数
  const getUnit = (itemName: string) => {
    // 特定の販促グッズの場合は「枚」を返す
    if (specialPromotionalItems.some((name) => itemName.includes(name))) {
      return "枚"
    }
    return isApparelItem(itemName) ? "枚" : "個"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-4 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">ショッピングカート</h1>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6 flex items-center" onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          買い物を続ける
        </Button>

        {cartItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="text-5xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold mb-2">カートは空です</h3>
            <p className="text-gray-500 mb-6">商品を追加してください</p>
            <Button onClick={() => router.push("/products")} className="px-6">
              商品一覧に戻る
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* カート商品リスト */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">カート内の商品 ({cartItems.length}点)</h2>

                  {cartItems.map((item) => (
                    <div key={item.id} className="mb-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative h-24 w-24 bg-gray-100 rounded-md flex-shrink-0">
                          <Image
                            src={getProductImage(item) || "/placeholder.svg"}
                            alt={item.item_name}
                            fill
                            className="object-contain p-2"
                            onError={(e) => {
                              console.error(`Error loading image for ${item.item_name}, using fallback`)
                              e.currentTarget.src = COMING_SOON_IMAGE_URL
                            }}
                          />
                          <Badge className="absolute -top-2 -right-2 bg-blue-600 text-xs">{item.item_category}</Badge>
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between">
                            <h3 className="font-medium">{item.item_name}</h3>
                            <p className="font-semibold">¥{calculateItemPrice(item).toLocaleString()}</p>
                          </div>

                          {/* 詳細情報（カラー、サイズなど） */}
                          <div className="text-sm text-gray-500 mb-2">
                            {item.selectedColor && <span className="mr-2">カラー: {item.selectedColor}</span>}
                            {item.selectedSize && <span className="mr-2">サイズ: {item.selectedSize}</span>}
                            {item.item_category === "販促グッズ" && item.selectedQuantity && (
                              <span className="mr-2">
                                {/* 特定の販促グッズの場合は「枚」を表示 */}
                                {specialPromotionalItems.some((name) => item.item_name.includes(name))
                                  ? `${item.selectedQuantity}枚セット`
                                  : `${item.selectedQuantity}個セット`}
                              </span>
                            )}
                            <span className="text-green-600">
                              納期: {displayDeliveryTime(item.lead_time, item.item_category)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center">
                              <span>
                                {item.quantity} {getUnit(item.item_name)}
                              </span>
                            </div>

                            {/* 削除ボタン */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 注文サマリー */}
            <div>
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">注文サマリー</h2>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">小計</span>
                      <span>¥{calculateSubtotal().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">消費税 (10%)</span>
                      <span>¥{calculateTax().toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>合計（税込）</span>
                      <span>¥{calculateTotal().toLocaleString()}</span>
                    </div>

                    <Button
                      className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? (
                        <span className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          処理中...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <ShoppingBag className="mr-2 h-5 w-5" />
                          注文を確認する
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="bg-gray-800 text-white py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">
            <p>&copy; SPLASH'N'GO!Item Store. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

