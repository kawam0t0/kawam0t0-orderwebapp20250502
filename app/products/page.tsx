"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShoppingCart, Search, ChevronRight, LogOut, History, Check } from "lucide-react"
import { addWeeks, format } from "date-fns"
import { ja } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"

// 商品タイプの定義を更新
type Product = {
  id: string
  category: string
  name: string
  colors?: string[]
  sizes?: string[]
  amounts?: number[]
  prices?: string[]
  pricesPerPiece?: string[] // 1個あたりの価格
  leadTime: string
  partnerName?: string // パートナー名を追加
  imageUrl?: string // 画像URLを追加
}

type CartItem = {
  id: string
  item_category: string
  item_name: string
  item_price: string
  lead_time: string
  selectedColor?: string
  selectedSize?: string
  selectedQuantity?: number
  quantity: number
  partnerName?: string // パートナー名を追加
  imageUrl?: string // 画像URLを追加
}

// アパレル商品かどうかを判定する関数
const isApparelItem = (name: string): boolean => {
  const apparelItems = ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"]
  return apparelItems.some((item) => name.includes(item))
}

// サイズによって価格が変わる商品かどうかを判定する関数
const hasSizeBasedPrice = (name: string): boolean => {
  return name.includes("Tシャツ") || name.includes("フーディ")
}

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

// サイズによって価格が変わる商品かどうかを判定する関数の後に、ハードコードされた価格情報を追加します
// Tシャツのサイズごとの価格を定義（フォールバック用）
const TSHIRT_PRICES: { [size: string]: number } = {
  M: 1810,
  L: 1810,
  XL: 1810,
  XXL: 2040,
}

// フーディのサイズごとの価格を定義（フォールバック用）
const HOODIE_PRICES: { [size: string]: number } = {
  M: 3210,
  L: 3210,
  XL: 3210,
  XXL: 3770,
  XXXL: 4000,
}

// デフォルトの画像プレースホルダーURL
const DEFAULT_PLACEHOLDER_URL = "/diverse-products-still-life.png"

// Google DriveのURLを直接表示可能な形式に変換する関数
const convertGoogleDriveUrl = (url: string): string => {
  try {
    if (!url) return DEFAULT_PLACEHOLDER_URL

    // URLが空文字列または無効な場合はプレースホルダーを返す
    if (url.trim() === "") return DEFAULT_PLACEHOLDER_URL

    // Google DriveのURLかどうかを確認
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

export default function ProductsPage() {
  const router = useRouter()
  const { open: openToast } = useToast()
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({})
  const [selectedSizes, setSelectedSizes] = useState<{ [key: string]: string }>({})
  const [selectedAmounts, setSelectedAmounts] = useState<{ [key: string]: number }>({})
  const [productPrices, setProductPrices] = useState<{ [key: string]: { [size: string]: number } }>({})
  const [isLoading, setIsLoading] = useState(true)

  // スプレッドシートからデータを取得
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      try {
        console.log("Fetching products from API...")
        const response = await fetch("/api/sheets?sheet=Available_items")
        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()

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

        // 画像URLを変換
        const productsWithConvertedUrls = data.map((product) => {
          const convertedUrl = product.imageUrl ? convertGoogleDriveUrl(product.imageUrl) : DEFAULT_PLACEHOLDER_URL
          return {
            ...product,
            imageUrl: convertedUrl,
          }
        })

        setProducts(productsWithConvertedUrls)

        // カテゴリーの抽出
        const uniqueCategories = [...new Set(data.map((product: Product) => product.category))] as string[]
        setCategories(uniqueCategories)

        // 初期選択状態を設定
        const initialColors: { [key: string]: string } = {}
        const initialSizes: { [key: string]: string } = {}
        const initialAmounts: { [key: string]: number } = {}
        const initialPrices: { [key: string]: { [size: string]: number } } = {}

        data.forEach((product: Product) => {
          if (isApparelItem(product.name)) {
            if (product.colors && product.colors.length > 0) {
              initialColors[product.id] = product.colors[0]
            }
            if (product.sizes && product.sizes.length > 0) {
              initialSizes[product.id] = product.sizes[0]
            }
            initialAmounts[product.id] = 1

            // サイズごとの価格マッピングを作成（Tシャツとフーディのみ）
            if (hasSizeBasedPrice(product.name)) {
              const sizePriceMap: { [size: string]: number } = {}

              // Tシャツの場合
              if (product.name.includes("Tシャツ")) {
                // スプレッドシートのデータを使用
                if (product.sizes && product.sizes.length > 0) {
                  product.sizes.forEach((size) => {
                    // ハードコードされた価格を使用
                    sizePriceMap[size] = TSHIRT_PRICES[size] || 1810
                  })
                } else {
                  // サイズ情報がない場合はフォールバック
                  Object.keys(TSHIRT_PRICES).forEach((size) => {
                    sizePriceMap[size] = TSHIRT_PRICES[size]
                  })
                }
              }
              // フーディの場合
              else if (product.name.includes("フーディ")) {
                // スプレッドシートのデータを使用
                if (product.sizes && product.sizes.length > 0) {
                  product.sizes.forEach((size) => {
                    // ハードコードされた価格を使用
                    sizePriceMap[size] = HOODIE_PRICES[size] || 3210
                  })
                } else {
                  // サイズ情報がない場合はフォールバック
                  Object.keys(HOODIE_PRICES).forEach((size) => {
                    sizePriceMap[size] = HOODIE_PRICES[size]
                  })
                }
              }

              // デバッグ用：価格マッピングを確認
              console.log(`Price mapping for ${product.name}:`, sizePriceMap)

              initialPrices[product.id] = sizePriceMap
            }
          } else if (product.category === "販促グッズ" && product.amounts && product.amounts.length > 0) {
            initialAmounts[product.id] = product.amounts[0]
          } else {
            initialAmounts[product.id] = 1
          }
        })

        setSelectedColors(initialColors)
        setSelectedSizes(initialSizes)
        setSelectedAmounts(initialAmounts)
        setProductPrices(initialPrices)
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setIsLoading(false)
      }
    }

    // ローカルストレージからカート情報を取得
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse cart data:", e)
      }
    }

    fetchProducts()
  }, [])

  // カートに商品を追加する処理
  const addToCart = (product: Product) => {
    // デバッグ用：パートナー名の確認
    console.log(`Adding product to cart: ${product.name}, Partner: ${product.partnerName || "None"}`)

    let cartItem: CartItem | null = null

    // アパレル商品の場合
    if (isApparelItem(product.name)) {
      const color = selectedColors[product.id]
      const size = selectedSizes[product.id]
      const quantity = selectedAmounts[product.id] || 1 // 選択された数量を使用

      if (!color || !size) {
        alert("カラーとサイズを選択してください")
        return
      }

      // サイズに応じた価格を取得
      let itemPrice = "0"

      // Tシャツとフーディはサイズごとに価格が異なる
      if (hasSizeBasedPrice(product.name) && productPrices[product.id] && productPrices[product.id][size]) {
        itemPrice = productPrices[product.id][size].toString()
      } else if (product.name.includes("Tシャツ") && TSHIRT_PRICES[size]) {
        itemPrice = TSHIRT_PRICES[size].toString()
      } else if (product.name.includes("フーディ") && HOODIE_PRICES[size]) {
        itemPrice = HOODIE_PRICES[size].toString()
      } else if (product.prices && product.prices.length > 0) {
        itemPrice = product.prices[0]
      }

      cartItem = {
        id: product.id,
        item_category: product.category,
        item_name: product.name,
        item_price: itemPrice,
        lead_time: product.leadTime,
        selectedColor: color,
        selectedSize: size,
        quantity, // 選択された数量を設定
        partnerName: product.partnerName, // パートナー名を追加
        imageUrl: product.imageUrl, // 画像URLを追加
      }
    }
    // 販促グッズの場合
    else if (product.category === "販促グッズ" && product.amounts && product.amounts.length > 0) {
      const selectedAmount = selectedAmounts[product.id]

      if (!selectedAmount) {
        alert("数量を選択してください")
        return
      }

      // 選択した数量のインデックスを見つける
      const amountIndex = product.amounts.findIndex((amount) => amount === selectedAmount)

      // 対応する価格を取得
      const selectedPrice = product.prices && amountIndex !== -1 ? product.prices[amountIndex] : "0"

      // 特定の販促グッズの場合は、selectedQuantity と quantity の両方に選択された数量を設定
      const isSpecialPromotionalItem = specialPromotionalItems.some((name) => product.name.includes(name))

      cartItem = {
        id: product.id,
        item_category: product.category,
        item_name: product.name,
        item_price: selectedPrice,
        lead_time: product.leadTime,
        selectedQuantity: selectedAmount,
        quantity: isSpecialPromotionalItem ? selectedAmount : 1, // 特定の販促グッズの場合は選択された数量、それ以外は1セット
        partnerName: product.partnerName, // パートナー名を追加
        imageUrl: product.imageUrl, // 画像URLを追加
      }
    }
    // その他の商品の場合
    else {
      const quantity = selectedAmounts[product.id] || 1 // 選択された数量を使用

      cartItem = {
        id: product.id,
        item_category: product.category,
        item_name: product.name,
        item_price: product.prices?.[0] || "0",
        lead_time: product.leadTime,
        quantity, // 選択された数量を設定
        partnerName: product.partnerName, // パートナー名を追加
        imageUrl: product.imageUrl, // 画像URLを追加
      }
    }

    if (cartItem) {
      // カート追加前の確認
      console.log("Adding to cart:", cartItem)

      const updatedCart = [...cart, cartItem]
      setCart(updatedCart)
      localStorage.setItem("cart", JSON.stringify(updatedCart))

      // トースト通知を表示
      showAddToCartToast(product, cartItem)
    }
  }

  // カートに追加時のトースト通知を表示
  const showAddToCartToast = (product: Product, cartItem: CartItem) => {
    // 単位を決定
    const unit = isApparelItem(product.name) ? "枚" : "個"

    // トースト通知を表示
    openToast(
      <div className="flex items-center">
        <div className="bg-blue-100 rounded-full p-2 mr-3">
          <Check className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">カートに追加しました</p>
          <p className="text-sm text-gray-600 truncate max-w-[200px]">{product.name}</p>
          {cartItem.quantity > 1 && (
            <p className="text-xs text-gray-500">
              {cartItem.quantity}
              {unit}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
          onClick={() => router.push("/cart")}
        >
          カートを見る
        </Button>
      </div>,
      4000, // 4秒間表示
    )
  }

  // 数量の変更処理
  const handleAmountChange = (productId: string, amount: number) => {
    setSelectedAmounts((prev) => ({
      ...prev,
      [productId]: amount,
    }))
  }

  // カラーの変更処理
  const handleColorChange = (productId: string, color: string) => {
    setSelectedColors((prev) => ({
      ...prev,
      [productId]: color,
    }))
  }

  // サイズの変更処理
  const handleSizeChange = (productId: string, size: string) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [productId]: size,
    }))

    // デバッグ用：サイズ変更時の価格情報を確認
    const product = products.find((p) => p.id === productId)
    if (product && hasSizeBasedPrice(product.name)) {
      console.log(`Size changed to ${size} for ${product.name}`)
      console.log(`Price mapping:`, productPrices[productId])
      console.log(`Selected price:`, productPrices[productId]?.[size])
    }
  }

  // 商品のフィルタリング
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true
    const matchesSearch = searchQuery
      ? product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true

    return matchesCategory && matchesSearch
  })

  // 商品の価格計算
  const calculatePrice = (product: Product) => {
    // アパレル商品の場合
    if (isApparelItem(product.name)) {
      const amount = selectedAmounts[product.id] || 1
      const selectedSize = selectedSizes[product.id]

      // サイズに応じた価格を取得
      let basePrice = 0

      // Tシャツとフーディはサイズごとに価格が異なる
      if (hasSizeBasedPrice(product.name) && selectedSize) {
        if (productPrices[product.id] && productPrices[product.id][selectedSize]) {
          // 保存されている価格マッピングを使用
          basePrice = productPrices[product.id][selectedSize]
        } else if (product.name.includes("Tシャツ") && TSHIRT_PRICES[selectedSize]) {
          // フォールバック：Tシャツの定義済み価格を使用
          basePrice = TSHIRT_PRICES[selectedSize]
        } else if (product.name.includes("フーディ") && HOODIE_PRICES[selectedSize]) {
          // フォールバック：フーディの定義済み価格を使用
          basePrice = HOODIE_PRICES[selectedSize]
        }
      } else if (product.prices && product.prices.length > 0) {
        basePrice = Number(product.prices[0].replace(/[^0-9.-]+/g, ""))
      }

      return (basePrice * amount).toLocaleString()
    }
    // 販促グッズの場合
    else if (product.category === "販促グッズ" && product.amounts && product.amounts.length > 0) {
      const selectedAmount = selectedAmounts[product.id]
      if (!selectedAmount) return "価格未定"

      const amountIndex = product.amounts.findIndex((amount) => amount === selectedAmount)

      if (amountIndex !== -1 && product.prices && product.prices[amountIndex]) {
        return Number(product.prices[amountIndex].replace(/[^0-9.-]+/g, "")).toLocaleString()
      } else {
        return "価格未定"
      }
    }
    // その他の商品の場合
    else {
      const amount = selectedAmounts[product.id] || 1
      const basePrice =
        product.prices && product.prices.length > 0 ? Number(product.prices[0].replace(/[^0-9.-]+/g, "")) : 0

      return (basePrice * amount).toLocaleString()
    }
  }

  // 1個あたりの価格を計算（販促グッズ用）
  const calculatePricePerPiece = (product: Product) => {
    if (product.category === "販促グッズ" && product.amounts && product.pricesPerPiece) {
      const selectedAmount = selectedAmounts[product.id]
      if (!selectedAmount) return null

      const amountIndex = product.amounts.findIndex((amount) => amount === selectedAmount)

      if (amountIndex !== -1 && product.pricesPerPiece[amountIndex]) {
        return Number(product.pricesPerPiece[amountIndex].replace(/[^0-9.-]+/g, "")).toLocaleString()
      }
    }
    return null
  }

  // 納期の計算
  const calculateDeliveryDate = (leadTime: string, category: string) => {
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

  // 商品画像の取得関数
  const getProductImage = (product: Product) => {
    // 画像URLが存在し、有効な場合はそれを使用
    if (product.imageUrl && product.imageUrl.trim() !== "") {
      // デバッグ用：画像URLを確認
      console.log(`Using image URL for ${product.name}: ${product.imageUrl}`)
      return product.imageUrl
    }

    // 画像URLがない場合はプレースホルダーを使用
    console.log(`No image URL found for ${product.name}, using placeholder`)
    return DEFAULT_PLACEHOLDER_URL
  }

  // 数量選択のプルダウンを生成する関数
  const generateQuantityOptions = (product) => {
    // 特定の販促グッズの場合は、選択された数量をそのまま使用
    if (specialPromotionalItems.some((item) => product.name.includes(item))) {
      return product.amounts.map((amount) => ({
        value: amount.toString(),
        label: `${amount}枚`,
      }))
    }

    // その他の商品は従来通りの処理
    return product.amounts.map((amount, index) => ({
      value: amount.toString(),
      label: `${amount}${product.name.includes("液剤") ? "本" : "枚"} (${product.prices[index]})`,
    }))
  }

  // カテゴリーの順序を定義
  const CATEGORY_ORDER = ["すべて", "販促グッズ", "液剤"] // アパレルとクロスを削除

  const [cartItems, setCartItems] = useState<CartItem[]>([])

  useEffect(() => {
    // ローカルストレージからカート情報を取得
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse cart data:", e)
      }
    }
  }, [cart])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">
                SPLASH'N'GO!備品
                <span className="text-blue-200 ml-2 text-lg font-normal">アイテム一覧</span>
              </h1>
              <p className="text-blue-200 text-sm mt-1">オリジナルグッズ・備品発注システム</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                onClick={() => router.push("/order-history")}
              >
                <History className="h-5 w-5 mr-2" />
                <span className="text-sm">発注履歴</span>
              </Button>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 h-10 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                onClick={() => {
                  localStorage.removeItem("cart")
                  router.push("/login")
                }}
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span className="text-sm">ログアウト</span>
              </Button>
              <Button
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-3 h-12 w-12 backdrop-blur-sm transition-all duration-200 hover:scale-105 relative group"
                onClick={() => router.push("/cart")}
              >
                <ShoppingCart className="h-6 w-6" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-in zoom-in duration-200">
                    {cartItems.length}
                  </span>
                )}
                <span className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full right-0 mb-2 whitespace-nowrap bg-black/75 text-white text-sm py-1 px-2 rounded">
                  カートを表示
                </span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* 検索バー */}
        <div className="relative mb-8 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="search"
              placeholder="商品名やカテゴリで検索..."
              className="pl-10 pr-4 py-3 rounded-full border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* カテゴリータブ */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex space-x-2 min-w-max">
            {CATEGORY_ORDER.map((category) => (
              <Button
                key={category}
                variant={
                  category === "すべて"
                    ? !selectedCategory
                      ? "default"
                      : "outline"
                    : selectedCategory === category
                      ? "default"
                      : "outline"
                }
                className={`rounded-full px-4 py-2 ${
                  (category === "すべて" && !selectedCategory) || selectedCategory === category
                    ? "bg-blue-600 text-white"
                    : ""
                }`}
                onClick={() => setSelectedCategory(category === "すべて" ? null : category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* ローディング表示 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* 商品グリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow border border-gray-200 rounded-xl"
                >
                  {/* 水色の枠内に画像を表示 */}
                  <div className="relative pt-[100%] bg-gray-50 border-2 border-cyan-300">
                    <Image
                      src={getProductImage(product) || "/placeholder.svg"}
                      alt={product.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      onError={(e) => {
                        // 画像の読み込みエラー時にプレースホルダーを表示
                        console.error(`Error loading image for ${product.name}, using placeholder`)
                        e.currentTarget.src = DEFAULT_PLACEHOLDER_URL
                      }}
                    />
                    <Badge className="absolute top-2 left-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                      {product.category}
                    </Badge>
                  </div>

                  <CardContent className="flex-grow p-4">
                    <h3 className="font-semibold text-lg mb-3 line-clamp-2">{product.name}</h3>

                    {/* 商品カードの納期表示部分を修正 */}
                    <p className="text-sm text-green-600 mb-4 flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-2"></span>
                      納期: {calculateDeliveryDate(product.leadTime, product.category)}
                    </p>

                    {/* アパレル商品の場合 */}
                    {isApparelItem(product.name) ? (
                      <>
                        {/* カラー選択 */}
                        {product.colors && product.colors.length > 0 && (
                          <div className="mb-3">
                            <Select
                              value={selectedColors[product.id]}
                              onValueChange={(value) => handleColorChange(product.id, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="カラーを選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {product.colors.map((color) => (
                                  <SelectItem key={`${product.id}-color-${color}`} value={color}>
                                    {color}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* サイズ選択 */}
                        {product.sizes && product.sizes.length > 0 && (
                          <div className="mb-3">
                            <Select
                              value={selectedSizes[product.id]}
                              onValueChange={(value) => handleSizeChange(product.id, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="サイズを選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {product.sizes.map((size) => (
                                  <SelectItem key={`${product.id}-size-${size}`} value={size}>
                                    {size}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* 数量選択（1-10枚） - アパレル商品用 */}
                        <div className="mb-3">
                          <Select
                            value={String(selectedAmounts[product.id] || 1)}
                            onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="数量を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(10)].map((_, i) => (
                                <SelectItem key={`${product.id}-amount-${i + 1}`} value={String(i + 1)}>
                                  {i + 1}枚
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : // 販促グッズの場合
                    product.category === "販促グッズ" && product.amounts && product.amounts.length > 0 ? (
                      <div className="mb-3">
                        <Select
                          value={String(selectedAmounts[product.id] || product.amounts[0])}
                          onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="数量を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.amounts.map((amount) => (
                              <SelectItem key={`${product.id}-amount-${amount}`} value={String(amount)}>
                                {/* 特定の販促グッズの場合は単位を「枚」に固定 */}
                                {specialPromotionalItems.some((item) => product.name.includes(item))
                                  ? `${amount}枚`
                                  : `${amount}個`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      // その他の商品の場合
                      !isApparelItem(product.name) && (
                        <div className="mb-3">
                          <Select
                            value={String(selectedAmounts[product.id] || 1)}
                            onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="数量を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(10)].map((_, i) => (
                                <SelectItem key={`${product.id}-amount-${i + 1}`} value={String(i + 1)}>
                                  {i + 1}個
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    )}
                    {/* 価格表示 */}
                    <div className="mt-4">
                      <p className="text-xl font-bold text-blue-700">¥{calculatePrice(product)}</p>
                      {/* Tシャツとフーディの場合、サイズによって価格が変わることを表示 */}
                      {hasSizeBasedPrice(product.name) && (
                        <p className="text-xs text-gray-500">※サイズによって価格が変わります</p>
                      )}
                      {/* 販促グッズの場合、1個あたりの価格を表示 */}
                      {product.category === "販促グッズ" && product.amounts && product.amounts.length > 0 && (
                        <>
                          {calculatePricePerPiece(product) && (
                            <p className="text-xs text-gray-500">¥{calculatePricePerPiece(product)}/個</p>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 transition-all duration-200 flex items-center justify-center gap-2"
                      onClick={() => addToCart(product)}
                      disabled={
                        isApparelItem(product.name) && (!selectedColors[product.id] || !selectedSizes[product.id])
                      }
                    >
                      カートに追加
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* 商品が見つからない場合 */}
            {filteredProducts.length === 0 && !isLoading && (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">商品が見つかりませんでした</h3>
                <p className="text-gray-500 mb-4">検索条件を変更するか、別のカテゴリーを選択してください</p>
                <Button
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory(null)
                  }}
                >
                  すべての商品を表示
                </Button>
              </div>
            )}
          </>
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
