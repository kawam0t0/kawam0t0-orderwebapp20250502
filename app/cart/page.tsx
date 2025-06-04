"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Trash2, ArrowLeft, ShoppingBag } from "lucide-react"
import { format, addWeeks, addDays } from "date-fns"
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
  "ピッカークロス",
]

// アパレル商品かどうかを判定する関数
const isApparelItem = (name: string): boolean => {
  const apparelItems = ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"]
  return apparelItems.some((item) => name.includes(item))
}

// 3週間後の納期を表示する商品リストを更新
const threeWeeksDeliveryItems = [
  "Tシャツ",
  "フーディ",
  "ワークシャツ",
  "つなぎ",
  "ポイントカード",
  "サブスクメンバーズカード",
  "サブスクフライヤー",
  "フリーチケット",
  "クーポン券",
  "のぼり",
  "お年賀",
  "利用規約",
]

// 4日後の納期を表示する商品リストを更新（3日後から4日後に変更）
const fourDaysDeliveryItems = ["スプシャン", "スプワックス", "スプコート", "セラミック", "スプタイヤ", "ピッカークロス"]

// 数量の表示方法を修正する関数
const formatQuantity = (item) => {
  // のぼりの商品の場合は「1セット」と表示
  if (item.item_name.includes("のぼり(6枚1セット)") || item.item_name.includes("のぼり(10枚1セット)")) {
    return "1セット"
  }

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
        console.log(`Converting Google Drive URL for file ID: ${fileId}`)
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

// 商品画像の取得関数を改善
const getProductImage = (item: CartItem, products: any[]) => {
  // 商品に画像URLがある場合はそれを使用
  if (item.imageUrl && item.imageUrl.trim() !== "") {
    console.log(`Using image URL for ${item.item_name}: ${item.imageUrl}`)
    return item.imageUrl
  }

  // 商品名と選択された色に基づいて一致する商品を検索
  if (item.selectedColor) {
    // 同じ商品名と選択された色の商品バリアントを検索
    const colorVariants = products.filter(
      (product) =>
        product.name === item.item_name &&
        product.color === item.selectedColor &&
        product.imageUrl &&
        product.imageUrl.trim() !== "",
    )

    if (colorVariants.length > 0) {
      // 最初に見つかった一致するバリエーションを使用
      const bestMatch = colorVariants[0]
      console.log(
        `Found matching color variant for ${item.item_name} in color ${item.selectedColor}: ${bestMatch.imageUrl}`,
      )
      return convertGoogleDriveUrl(bestMatch.imageUrl)
    }
  }

  // 商品名で一致する商品を検索（色が一致しない場合のフォールバック）
  const matchingProduct = products.find((product) => product.name === item.item_name)
  if (matchingProduct && matchingProduct.imageUrl && matchingProduct.imageUrl.trim() !== "") {
    console.log(`Found matching product with image URL for ${item.item_name}: ${matchingProduct.imageUrl}`)
    return convertGoogleDriveUrl(matchingProduct.imageUrl)
  }

  // 画像URLがない場合はプレースホルダーを使用
  console.log(`No image URL found for ${item.item_name}, using placeholder`)
  return DEFAULT_PLACEHOLDER_URL
}

// 商品価格の計算関数を修正
const calculateItemPrice = (item: CartItem) => {
  // 特定の販促グッズの場合は固定価格を返す
  if (specialPromotionalItems.some((name) => item.item_name.includes(name))) {
    // 選択された数量に対応する固定価格をそのまま使用
    return Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
  }

  // アパレル商品の場合
  if (isApparelItem(item.item_name)) {
    const basePrice = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
    return basePrice * item.quantity
  }

  // その他の商品の場合
  else {
    const basePrice = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
    return basePrice * item.quantity
  }
}

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({})
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [products, setProducts] = useState<any[]>([]) //   setIsCheckingOut] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
    setIsLoading(true)
    try {
      console.log("Fetching products for cart...")
      const response = await fetch("/api/sheets?sheet=Available_items")
      if (response.ok) {
        const data = await response.json()
        setProducts(data)

        // デバッグ用：データ構造を確認
        console.log("Fetched products data:", data.length, "items")
        console.log(
          "Sample products (first 3):",
          data.slice(0, 3).map((p) => ({
            name: p.name,
            imageUrl: p.imageUrl,
          })),
        )

        // 画像URLを持つ商品の数をカウント
        const itemsWithImages = data.filter((p) => p.imageUrl && p.imageUrl.trim() !== "").length
        console.log(`Found ${itemsWithImages} items with image URLs out of ${data.length} total items`)

        // カート内の商品に画像URLを追加
        if (data && data.length > 0) {
          const savedCart = localStorage.getItem("cart")
          if (savedCart) {
            const items = JSON.parse(savedCart)
            const updatedItems = items.map((item: CartItem) => {
              // 商品名で一致する商品を検索
              const matchingProduct = data.find((product) => product.name === item.item_name)
              if (matchingProduct && matchingProduct.imageUrl) {
                console.log(`Found matching product with image URL for ${item.item_name}: ${matchingProduct.imageUrl}`)
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
    } finally {
      setIsLoading(false)
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

  // 注文処理
  const handleCheckout = () => {
    router.push("/checkout")
  }

  // 納期の表示（修正版）
  const displayDeliveryTime = (itemName: string) => {
    // 3週間後の納期を表示する商品
    if (threeWeeksDeliveryItems.some((item) => itemName.includes(item))) {
      const deliveryDate = addWeeks(new Date(), 3)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    // 4日後の納期を表示する商品（3日後から4日後に変更）
    if (fourDaysDeliveryItems.some((item) => itemName.includes(item))) {
      const deliveryDate = addDays(new Date(), 4)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    // その他の商品は従来通りの計算
    return "2週間程度"
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

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : cartItems.length === 0 ? (
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
                            src={getProductImage(item, products) || "/placeholder.svg"}
                            alt={item.item_name}
                            fill
                            className="object-contain p-2"
                            onError={(e) => {
                              console.error(`Error loading image for ${item.item_name}, using placeholder`)
                              e.currentTarget.src = DEFAULT_PLACEHOLDER_URL
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
                            <span className="text-green-600">納期: {displayDeliveryTime(item.item_name)}</span>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center">
                              <span>{formatQuantity(item)}</span>
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
