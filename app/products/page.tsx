"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShoppingCart, Search, ChevronRight, LogOut, History } from 'lucide-react'
import { addWeeks, format, addDays } from "date-fns"
import { ja } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

// 商品タイプの定義
type Product = {
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
  color?: string
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
  partnerName?: string
  imageUrl?: string
}

// アパレル商品かどうかを判定する関数
const isApparelItem = (name: string): boolean => {
  const apparelItems = ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"]
  return apparelItems.some((item) => name.includes(item))
}

// アルミ合板商品かどうかを判定する関数
const isAluminumBoardItem = (name: string): boolean => {
  const ALUMINUM_BOARD_ITEMS = [
    "料金表(アルミ合板4コース)",
    "利用規約看板(アルミ合板)",
    "出口信号看板(アルミ合板)",
    "タオル分別ボード(アルミ合板)",
    "マットクリーナーステッカー",
  ]
  return ALUMINUM_BOARD_ITEMS.some((item) => name.includes(item))
}

// 液剤商品かどうかを判定する関数（新規追加）
const isLiquidItem = (name: string): boolean => {
  const liquidItems = ["スプシャン", "スプワックス", "スプコート", "セラミック", "スプタイヤ", "ピッカークロスミニ"]
  return liquidItems.some((item) => name.includes(item))
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
  "お年賀",
  "利用規約",
  "ピッカークロス",
]

// コースシールの枚数ごとの固定価格
const COURSE_STICKER_PRICES: { quantity: number; label: string; price: number }[] = [
  { quantity: 300, label: "300枚", price: 10252 },
  { quantity: 500, label: "500枚", price: 10670 },
  { quantity: 1000, label: "1000枚", price: 11506 },
]

// コースシール商品リスト
const courseStickers = [
  "コースシール（Premium）",
  "コースシール（CoatingPlus）",
  "コースシール（Niagara）",
  "コースシール（Ceramic）",
]
const isCourseSticker = (name: string): boolean => {
  return courseStickers.some((sticker) => name.includes(sticker))
}

// デフォルトの画像プレースホルダーURL
const DEFAULT_PLACEHOLDER_URL = "/placeholder.svg"

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

// 4日後の納期を表示する商品リスト
const fourDaysDeliveryItems = ["スプシャン", "スプワックス", "スプコート", "セラミック", "スプタイヤ", "ピッカークロス"]

// 固定数量と価格のマッピング（更新版）
const FIXED_QUANTITY_PRICE_MAP = {
  ポイントカード: [
    { quantity: 1000, label: "1000枚", price: 29370 },
    { quantity: 3000, label: "3000枚", price: 46090 },
    { quantity: 5000, label: "5000枚", price: 62920 },
  ],
  サブスクメンバーズカード: [
    { quantity: 1000, label: "1000枚", price: 36080 },
    { quantity: 2000, label: "2000枚", price: 60000 },
    { quantity: 2500, label: "2500枚", price: 75000 },
    { quantity: 3000, label: "3000枚", price: 84000 },
  ],
  サブスクフライヤー: [
    { quantity: 500, label: "500枚", price: 6600 },
    { quantity: 1000, label: "1000枚", price: 7370 },
    { quantity: 1500, label: "1500枚", price: 8360 },
  ],
  フリーチケット: [{ quantity: 1000, label: "1000枚", price: 23100 }],
  クーポン券: [{ quantity: 1000, label: "1000枚", price: 42680 }],
  "のぼり(10枚1セット)": [{ quantity: 10, label: "1セット", price: 26620 }],
  "のぼり(6枚1セット)": [{ quantity: 6, label: "1セット", price: 19140 }],
  お年賀: [{ quantity: 100, label: "100枚", price: 25000 }],
  利用規約: [
    { quantity: 500, label: "500枚", price: 10000 },
    { quantity: 1000, label: "1000枚", price: 20000 },
  ],
  ピッカークロス: [
    { quantity: 1, label: "1", price: 30000 },
    { quantity: 2, label: "2", price: 60000 },
    { quantity: 3, label: "3", price: 90000 },
  ],
}

// Tシャツのサイズごとの価格を定義
const TSHIRT_PRICES: { [size: string]: number } = {
  M: 1810,
  L: 1810,
  XL: 1810,
  XXL: 2040,
}

// フーディのサイズごとの価格を定義
const HOODIE_PRICES: { [size: string]: number } = {
  M: 3210,
  L: 3210,
  XL: 3210,
  XXL: 3770,
  XXXL: 4000,
}

// 液剤商品の1本あたりの固定価格
const LIQUID_PRICES: { [key: string]: number } = {
  スプシャン: 6000,
  スプワックス: 40000,
  スプコート: 25000,
  セラミック: 120000,
  スプタイヤ: 7000,
  ピッカークロスミニ: 30000, // 1セット(400枚)あたりの価格
}

// 液剤商品の単価を取得する関数
const getLiquidBasePrice = (productName: string, storeName: string | null): number => {
  // 店舗固有の価格があればそちらを優先
  const storeSpecific = getStoreSpecificPrice(productName, storeName)
  if (storeSpecific !== null) return storeSpecific
  // 固定価格マップから取得
  for (const [key, price] of Object.entries(LIQUID_PRICES)) {
    if (productName.includes(key)) return price
  }
  return 0
}

// 店舗ごとの価格設定
const STORE_SPECIFIC_PRICES = {
  "SPLASH'N'GO!伊勢崎韮塚店": {
    スプワックス: 40000,
    スプコート: 25000,
  },
  "SPLASH'N'GO!高崎棟高店": {
    スプワックス: 37000,
    スプコート: 23000,
  },
  "SPLASH'N'GO!足利緑町店": {
    スプワックス: 37000,
    スプコート: 23000,
  },
  "SPLASH'N'GO!新前橋店": {
    スプワックス: 26000,
    スプコート: 20000,
  },
}

// 店舗に基づいて商品価格を取得する関数
const getStoreSpecificPrice = (productName: string, storeName: string | null): number | null => {
  if (!storeName) return null

  const matchingProduct = Object.keys(STORE_SPECIFIC_PRICES[storeName] || {}).find((product) =>
    productName.includes(product),
  )

  if (matchingProduct && STORE_SPECIFIC_PRICES[storeName]) {
    return STORE_SPECIFIC_PRICES[storeName][matchingProduct]
  }

  return null
}

// Google DriveのURLを直接表示可能な形式に変換する関数
const convertGoogleDriveUrl = (url: string): string => {
  try {
    if (!url) return DEFAULT_PLACEHOLDER_URL

    if (url.trim() === "") return DEFAULT_PLACEHOLDER_URL

    if (url.includes("drive.google.com/file/d/")) {
      const fileIdMatch = url.match(/\/d\/([^/]+)/)
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1]
        console.log(`Converting Google Drive URL for file ID: ${fileId}`)
        return `https://drive.google.com/uc?export=view&id=${fileId}`
      }
    }

    if (url.includes("drive.google.com/uc?export=view&id=")) {
      return url
    }

    return url
  } catch (error) {
    console.error("Error converting Google Drive URL:", error)
    return DEFAULT_PLACEHOLDER_URL
  }
}

// 商品画像の取得関数
const getProductImage = (product: Product, products: Product[], selectedColor?: string) => {
  console.log(`Getting image for ${product.name}, selected color: ${selectedColor || "none"}`)

  if (selectedColor) {
    const colorVariants = products.filter(
      (p) => p.name === product.name && p.color === selectedColor && p.imageUrl && p.imageUrl.trim() !== "",
    )

    if (colorVariants.length > 0) {
      console.log(`Found ${colorVariants.length} color variants for ${product.name} in color ${selectedColor}`)
      const bestMatch = colorVariants[0]
      console.log(`Selected best color match: ${bestMatch.imageUrl}`)
      return bestMatch.imageUrl
    }
  }

  if (product.imageUrl && product.imageUrl.trim() !== "") {
    return product.imageUrl
  }

  console.log(`No image URL found for ${product.name}, using placeholder`)
  return DEFAULT_PLACEHOLDER_URL
}

// 特定の商品名かどうかを判定する関数
const isSpecificProduct = (productName: string, keyword: string): boolean => {
  return productName.includes(keyword)
}

export default function ProductsPage() {
  const router = useRouter()
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

  // 店舗情報の状態
  const [storeName, setStoreName] = useState<string | null>(null)

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

        console.log("Fetched products data:", data.length, "items")

        const itemsWithImages = data.filter((p) => p.imageUrl && p.imageUrl.trim() !== "").length
        console.log(`Found ${itemsWithImages} items with image URLs out of ${data.length} total items`)

        // sheets.ts側で変換済みのURLをそのまま使用（二重変換しない）
        const productsWithConvertedUrls = data.map((product) => {
          return {
            ...product,
            imageUrl: product.imageUrl || DEFAULT_PLACEHOLDER_URL,
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
          // アルミ合板商品の場合は数量を1に固定
          if (isAluminumBoardItem(product.name)) {
            initialAmounts[product.id] = 1
          }
          // 液剤商品の場合は数量を1に設定（1-10から選択可能）
          else if (isLiquidItem(product.name)) {
            initialAmounts[product.id] = 1
          }
          // 特定の商品に対して初期値を設定
          else if (isSpecificProduct(product.name, "ポイントカード")) {
            initialAmounts[product.id] = 1000
          } else if (isSpecificProduct(product.name, "サブスクメンバーズカード")) {
            initialAmounts[product.id] = 1000
          } else if (isSpecificProduct(product.name, "サブスクフライヤー")) {
            initialAmounts[product.id] = 500
          } else if (isSpecificProduct(product.name, "フリーチケット")) {
            initialAmounts[product.id] = 1000
          } else if (isSpecificProduct(product.name, "クーポン券")) {
            initialAmounts[product.id] = 1000
          } else if (isSpecificProduct(product.name, "のぼり(10枚1セット)")) {
            initialAmounts[product.id] = 10
          } else if (isSpecificProduct(product.name, "のぼり(6枚1セット)")) {
            initialAmounts[product.id] = 6
          } else if (isSpecificProduct(product.name, "お年賀")) {
            initialAmounts[product.id] = 100
          } else if (isSpecificProduct(product.name, "利用規約")) {
            initialAmounts[product.id] = 500
          } else if (isSpecificProduct(product.name, "ピッカークロス")) {
            initialAmounts[product.id] = 1
          } else if (isCourseSticker(product.name)) {
            // コースシール初期数量300枚
            initialAmounts[product.id] = 300
          } else if (isApparelItem(product.name)) {
            if (product.colors && product.colors.length > 0) {
              initialColors[product.id] = product.colors[0]
            }
            if (product.sizes && product.sizes.length > 0) {
              initialSizes[product.id] = product.sizes[0]
            }
            initialAmounts[product.id] = 1

            // サイズごとの価格マッピングを作成
            if (hasSizeBasedPrice(product.name)) {
              const sizePriceMap: { [size: string]: number } = {}

              if (product.name.includes("Tシャツ")) {
                if (product.sizes && product.sizes.length > 0) {
                  product.sizes.forEach((size) => {
                    sizePriceMap[size] = TSHIRT_PRICES[size] || 1810
                  })
                } else {
                  Object.keys(TSHIRT_PRICES).forEach((size) => {
                    sizePriceMap[size] = TSHIRT_PRICES[size]
                  })
                }
              } else if (product.name.includes("フーディ")) {
                if (product.sizes && product.sizes.length > 0) {
                  product.sizes.forEach((size) => {
                    sizePriceMap[size] = HOODIE_PRICES[size] || 3210
                  })
                } else {
                  Object.keys(HOODIE_PRICES).forEach((size) => {
                    sizePriceMap[size] = HOODIE_PRICES[size]
                  })
                }
              }

              initialPrices[product.id] = sizePriceMap
            }
          } else if (product.amounts && product.amounts.length > 0) {
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

    // ローカルストレージから店舗情報を取得
    const savedStoreInfo = localStorage.getItem("storeInfo")
    if (savedStoreInfo) {
      try {
        const storeInfo = JSON.parse(savedStoreInfo)
        setStoreName(storeInfo.name)
        console.log("Store name loaded:", storeInfo.name)
      } catch (e) {
        console.error("Failed to parse store info:", e)
      }
    }

    fetchProducts()
  }, [])

  // addToCart 関数
  const addToCart = (product: Product) => {
    console.log(`Adding product to cart: ${product.name}, Partner: ${product.partnerName || "None"}`)

    const quantity = selectedAmounts[product.id] || 1

    let itemPrice = product.prices?.[0] || "0"

    // アルミ合板商品の場合は「要相談」
    if (isAluminumBoardItem(product.name)) {
      itemPrice = "要相談"
    } else {
      const storeSpecificPrice = getStoreSpecificPrice(product.name, storeName)
      if (storeSpecificPrice !== null) {
        itemPrice = storeSpecificPrice.toString()
      }

      // アパレル商品の場合の価格調整
      if (isApparelItem(product.name)) {
        const selectedSize = selectedSizes[product.id]
        if (hasSizeBasedPrice(product.name) && selectedSize) {
          if (productPrices[product.id] && productPrices[product.id][selectedSize]) {
            itemPrice = productPrices[product.id][selectedSize].toString()
          } else if (product.name.includes("Tシャツ") && TSHIRT_PRICES[selectedSize]) {
            itemPrice = TSHIRT_PRICES[selectedSize].toString()
          } else if (product.name.includes("フーディ") && HOODIE_PRICES[selectedSize]) {
            itemPrice = HOODIE_PRICES[selectedSize].toString()
          }
        }
      }
      // 液剤商品の場合：固定価格マップから1本あたりの価格を取得
      else if (isLiquidItem(product.name)) {
        itemPrice = getLiquidBasePrice(product.name, storeName).toString()
      }
      // 特定の販促グッズの場合の価格調整
      else if (specialPromotionalItems.some((item) => product.name.includes(item)) || isCourseSticker(product.name)) {
        const selectedAmount = selectedAmounts[product.id]
        let selectedPrice = "0"

        if (product.name.includes("利用規約") && !product.name.includes("看板")) {
          if (selectedAmount === 500) selectedPrice = "10000"
          if (selectedAmount === 1000) selectedPrice = "20000"
        } else if (product.name.includes("お年賀")) {
          selectedPrice = "25000"
        } else if (product.name.includes("サブスクメンバーズカード")) {
          if (selectedAmount === 1000) selectedPrice = "36080"
          if (selectedAmount === 2000) selectedPrice = "60000"
          if (selectedAmount === 2500) selectedPrice = "75000"
          if (selectedAmount === 3000) selectedPrice = "84000"
        } else if (isCourseSticker(product.name)) {
          // コースシール: 固定価格マップから取得
          const option = COURSE_STICKER_PRICES.find((o) => o.quantity === selectedAmount)
          selectedPrice = option ? option.price.toString() : COURSE_STICKER_PRICES[0].price.toString()
        } else {
          for (const [itemName, options] of Object.entries(FIXED_QUANTITY_PRICE_MAP)) {
            if (product.name.includes(itemName)) {
              const option = options.find((opt) => opt.quantity === selectedAmount)
              if (option) {
                selectedPrice = option.price.toString()
              }
            }
          }
        }
        if (selectedPrice === "0" && product.amounts) {
          const amountIndex = product.amounts.findIndex((amount) => amount === selectedAmount)
          if (amountIndex !== -1 && product.prices && product.prices[amountIndex]) {
            selectedPrice = product.prices[amountIndex]
          }
        }
        itemPrice = selectedPrice
      }
    }

    const newItem: CartItem = {
      id: product.id,
      item_category: product.category,
      item_name: product.name,
      item_price: itemPrice,
      lead_time: product.leadTime,
      selectedColor: selectedColors[product.id],
      selectedSize: selectedSizes[product.id],
      selectedQuantity: selectedAmounts[product.id],
      quantity,
      partnerName: product.partnerName,
      imageUrl: product.imageUrl,
    }

    const updatedCart = [...cart, newItem]
    setCart(updatedCart)
    localStorage.setItem("cart", JSON.stringify(updatedCart))

    // シンプルなアラート表示
    const unit = isApparelItem(product.name) ? "枚" : isLiquidItem(product.name) ? "本" : "個"
    const quantityText = quantity > 1 ? ` ${quantity}${unit}` : ""
    alert(`${product.name}${quantityText}をカートに追加しました`)
  }

  // 数量の変更処理
  const handleAmountChange = (productId: string, amount: number) => {
    console.log(`数量変更: 商品ID=${productId}, 数量=${amount}`)
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

    console.log(`Color changed to ${color} for product ${productId}`)

    const product = products.find((p) => p.id === productId)
    if (product) {
      console.log(`Updating image for ${product.name} to match color: ${color}`)
      setProducts([...products])
    }
  }

  // サイズの変更処理
  const handleSizeChange = (productId: string, size: string) => {
    setSelectedSizes((prev) => ({
      ...prev,
      [productId]: size,
    }))

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
    // アルミ合板商品の場合は「要相談」
    if (isAluminumBoardItem(product.name)) {
      return "要相談"
    }

    // 店舗固有の価格をチェック
    const storeSpecificPrice = getStoreSpecificPrice(product.name, storeName)
    if (storeSpecificPrice !== null) {
      const amount = selectedAmounts[product.id] || 1
      return (storeSpecificPrice * amount).toLocaleString()
    }

    // コースシール商品の価格設定（固定価格マップを使用）
    if (isCourseSticker(product.name)) {
      const selectedAmount = selectedAmounts[product.id]
      const option = COURSE_STICKER_PRICES.find((o) => o.quantity === selectedAmount)
      if (option) return option.price.toLocaleString()
      return COURSE_STICKER_PRICES[0].price.toLocaleString()
    }

    // 利用規約の価格設定（看板ではない方）
    if (product.name === "利用規約" && !product.name.includes("看板")) {
      const selectedAmount = selectedAmounts[product.id]
      if (selectedAmount === 500) return "10,000"
      if (selectedAmount === 1000) return "20,000"
      return "10,000" // デフォルト
    }

    // お年賀の価格設定
    if (isSpecificProduct(product.name, "お年賀")) {
      return "25,000"
    }

    // その他の特定商品の価格設定
    if (isSpecificProduct(product.name, "ポイントカード")) {
      const selectedAmount = selectedAmounts[product.id]
      if (selectedAmount === 1000) return "29,370"
      if (selectedAmount === 3000) return "46,090"
      if (selectedAmount === 5000) return "62,920"
    }

    if (isSpecificProduct(product.name, "サブスクメンバーズカード")) {
      const selectedAmount = selectedAmounts[product.id]
      if (selectedAmount === 1000) return "36,080"
      if (selectedAmount === 2000) return "60,000"
      if (selectedAmount === 2500) return "75,000"
      if (selectedAmount === 3000) return "84,000"
    }

    if (isSpecificProduct(product.name, "サブスクフライヤー")) {
      const selectedAmount = selectedAmounts[product.id]
      if (selectedAmount === 500) return "6,600"
      if (selectedAmount === 1000) return "7,370"
      if (selectedAmount === 1500) return "8,360"
    }

    if (isSpecificProduct(product.name, "フリーチケット")) {
      return "23,100"
    }

    if (isSpecificProduct(product.name, "クーポン券")) {
      return "42,680"
    }

    if (isSpecificProduct(product.name, "のぼり(10枚1セット)")) {
      return "26,620"
    }

    if (isSpecificProduct(product.name, "のぼり(6枚1セット)")) {
      return "19,140"
    }

    if (isSpecificProduct(product.name, "ピッカークロス")) {
      const selectedAmount = selectedAmounts[product.id]
      if (selectedAmount === 1) return "30,000"
      if (selectedAmount === 2) return "60,000"
      if (selectedAmount === 3) return "90,000"
    }

    // 液剤商品の場合：固定価格マップから1本あたりの価格 × 本数
    if (isLiquidItem(product.name)) {
      const amount = selectedAmounts[product.id] || 1
      const basePrice = getLiquidBasePrice(product.name, storeName)
      return (basePrice * amount).toLocaleString()
    }

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
    // その他の商品の場合
    else {
      const amount = selectedAmounts[product.id] || 1
      const basePrice =
        product.prices && product.prices.length > 0 ? Number(product.prices[0].replace(/[^0-9.-]+/g, "")) : 0

      return (basePrice * amount).toLocaleString()
    }
  }

  // 納期の計算関数を更新
  const calculateDeliveryDate = (productName: string) => {
    // 3週間後の納期を表示する商品
    if (threeWeeksDeliveryItems.some((item) => productName.includes(item))) {
      const deliveryDate = addWeeks(new Date(), 3)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    // 4日後の納期を表示する商品
    if (fourDaysDeliveryItems.some((item) => productName.includes(item))) {
      const deliveryDate = addDays(new Date(), 4)
      return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    // その他の商品は従来通りの計算
    return "1ヶ月程度"
  }

  // 数量選択のプルダウンを生成する関数
  const generateQuantityOptions = (product: Product) => {
    console.log(`Generating quantity options for: ${product.name}`)

    // アルミ合板商品の場合は数量1のみ
    if (isAluminumBoardItem(product.name)) {
      return [{ value: "1", label: "1個", price: 0 }]
    }

    // 液剤商品の場合は1-10本から選択
    if (isLiquidItem(product.name)) {
      return [...Array(10)].map((_, i) => ({
        value: (i + 1).toString(),
        label: `${i + 1}本`,
        price: 0,
      }))
    }

    // コースシール商品の場合（更新版）
    if (isCourseSticker(product.name)) {
      return [
        { value: "300", label: "300枚", price: 0 },
        { value: "500", label: "500枚", price: 0 },
        { value: "1000", label: "1000枚", price: 0 },
        { value: "1500", label: "1500枚", price: 0 },
        { value: "2000", label: "2000枚", price: 0 },
        { value: "2500", label: "2500枚", price: 0 },
      ]
    }

    // 特定の商品名に基づいて選択肢を生成
    if (isSpecificProduct(product.name, "ポイントカード")) {
      return [
        { value: "1000", label: "1000枚", price: 29370 },
        { value: "3000", label: "3000枚", price: 46090 },
        { value: "5000", label: "5000枚", price: 62920 },
      ]
    }

    if (isSpecificProduct(product.name, "サブスクメンバーズカード")) {
      return [
        { value: "1000", label: "1000枚", price: 36080 },
        { value: "2000", label: "2000枚", price: 60000 },
        { value: "2500", label: "2500枚", price: 75000 },
        { value: "3000", label: "3000枚", price: 84000 },
      ]
    }

    if (isSpecificProduct(product.name, "サブスクフライヤー")) {
      return [
        { value: "500", label: "500枚", price: 6600 },
        { value: "1000", label: "1000枚", price: 7370 },
        { value: "1500", label: "1500枚", price: 8360 },
      ]
    }

    if (isSpecificProduct(product.name, "フリーチケット")) {
      return [{ value: "1000", label: "1000枚", price: 23100 }]
    }

    if (isSpecificProduct(product.name, "クーポン券")) {
      return [{ value: "1000", label: "1000枚", price: 42680 }]
    }

    if (isSpecificProduct(product.name, "のぼり(10枚1セット)")) {
      return [{ value: "10", label: "1セット", price: 26620 }]
    }

    if (isSpecificProduct(product.name, "のぼり(6枚1セット)")) {
      return [{ value: "6", label: "1セット", price: 19140 }]
    }

    if (isSpecificProduct(product.name, "お年賀")) {
      return [{ value: "100", label: "100枚", price: 25000 }]
    }

    if (product.name === "利用規約" && !product.name.includes("看板")) {
      return [
        { value: "500", label: "500枚", price: 999999 },
        { value: "1000", label: "1000枚", price: 999999 },
      ]
    }

    if (isSpecificProduct(product.name, "ピッカークロス")) {
      return [
        { value: "1", label: "1", price: 30000 },
        { value: "2", label: "2", price: 60000 },
        { value: "3", label: "3", price: 90000 },
      ]
    }

    // その他の商品は従来通りの処理
    if (product.amounts && product.amounts.length > 0) {
      return product.amounts.map((amount, index) => ({
        value: amount.toString(),
        label: `${amount}${product.name.includes("液剤") ? "本" : "枚"} (${product.prices?.[index] || "0"})`,
        price: product.prices && product.prices[index] ? Number(product.prices[index].replace(/[^0-9.-]+/g, "")) : 0,
      }))
    }

    // デフォルトの選択肢（1-10）
    return [...Array(10)].map((_, i) => ({
      value: (i + 1).toString(),
      label: `${i + 1}${product.name.includes("液剤") ? "本" : "枚"}`,
      price: 0,
    }))
  }

  // カテゴリーの順序を定義
  const CATEGORY_ORDER = ["すべて"]

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
                    <img
                      src={getProductImage(product, products, selectedColors[product.id]) || DEFAULT_PLACEHOLDER_URL}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-contain p-4"
                      key={`${product.id}-${selectedColors[product.id]}`}
                      onError={(e) => {
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
                      納期: {calculateDeliveryDate(product.name)}
                    </p>

                    {/* アパレル商品の場合 */}
                    {isApparelItem(product.name) ? (
                      <>
                        {/* カラー選択 */}
                        {product.colors && product.colors.length > 0 && (
                          <div className="mb-3">
                            <Select
                              value={selectedColors[product.id] || "default-color"}
                              onValueChange={(value) =>
                                handleColorChange(product.id, value === "default-color" ? "" : value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="カラーを選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {product.colors.map((color) => (
                                  <SelectItem key={`${product.id}-color-${color}`} value={color || "default-color"}>
                                    {color || "標準"}
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
                              value={selectedSizes[product.id] || "default-size"}
                              onValueChange={(value) =>
                                handleSizeChange(product.id, value === "default-size" ? "" : value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="サイズを選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {product.sizes.map((size) => (
                                  <SelectItem key={`${product.id}-size-${size}`} value={size || "default-size"}>
                                    {size || "標準"}
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
                    ) : // ピッカークロスミニの場合（1・2・3）
                    isSpecificProduct(product.name, "ピッカークロス") ? (
                      <div className="mb-3">
                        <Select
                          value={String(selectedAmounts[product.id] || 1)}
                          onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="数量を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3].map((qty) => (
                              <SelectItem key={`${product.id}-picker-${qty}`} value={String(qty)}>
                                {qty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : // 液剤商品の場合（1〜10本）
                    isLiquidItem(product.name) ? (
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
                              <SelectItem key={`${product.id}-liquid-${i + 1}`} value={String(i + 1)}>
                                {i + 1}本
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : // 特定の販促グッズの場合
                    specialPromotionalItems.some((item) => product.name.includes(item)) ||
                      isCourseSticker(product.name) ||
                      isAluminumBoardItem(product.name) ? (
                      <div className="mb-3">
                        <Select
                          value={String(selectedAmounts[product.id] || 1)}
                          onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="数量を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {generateQuantityOptions(product).map((option) => (
                              <SelectItem key={`${product.id}-option-${option.value}`} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : // その他の商品の場合
                    product.amounts && product.amounts.length > 0 ? (
                      <div className="mb-3">
                        <Select
                          value={String(selectedAmounts[product.id] || (isCourseSticker(product.name) ? 300 : product.amounts[0]))}
                          onValueChange={(value) => handleAmountChange(product.id, Number(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="数量を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {(isCourseSticker(product.name) ? [300, 500, 1000] : product.amounts).map((amount, index) => {
                              return (
                                <SelectItem key={`${product.id}-amount-${amount}`} value={String(amount)}>
                                  {amount}枚
                                  {isCourseSticker(product.name) && (() => {
                                    const opt = COURSE_STICKER_PRICES.find((o) => o.quantity === amount)
                                    return opt ? ` (¥${opt.price.toLocaleString()})` : ""
                                  })()}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
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
                              <SelectItem key={`${product.id}-default-${i + 1}`} value={String(i + 1)}>
                                {i + 1}個
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 価格表示 */}
                    <div className="text-xl font-bold text-blue-600 mb-4">
                      {calculatePrice(product) === "要相談" ? (
                        <span className="text-orange-600">要相談</span>
                      ) : (
                        `¥${calculatePrice(product)}`
                      )}
                    </div>

                    {/* パートナー情報は非表示 */}
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-2 px-4 transition-colors duration-200 flex items-center justify-center"
                      onClick={() => addToCart(product)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      カートに追加
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* 商品が見つからない場合 */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <div className="text-gray-400 mb-4">
                  <Search className="h-16 w-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">商品が見つかりません</h3>
                <p className="text-gray-500">検索条件を変更してお試しください</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
