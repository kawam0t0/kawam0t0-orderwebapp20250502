"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Truck, CreditCard, Info } from "lucide-react"
import { addWeeks, format, addDays } from "date-fns"
import { ja } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

// コースシールの商品かどうかを判定する関数
const isCourseSticker = (name: string): boolean => {
  return name.includes("コースシール")
}

// アパレル商品かどうかを判定する関数
const isApparelItem = (name: string): boolean => {
  const apparelItems = ["Tシャツ", "フーディ", "ワークシャツ", "つなぎ"]
  return apparelItems.some((item) => name.includes(item))
}

type CartItem = {
  id: string
  item_category: string
  item_name: string
  selectedColor?: string
  selectedSize?: string
  selectedQuantity?: string | number
  quantity: number
  item_price: string | string[]
  lead_time: string
  imageUrl?: string // 画像URLを追加
}

// 数量の表示方法を修正する関数
const formatQuantity = (item: CartItem) => {
  // のぼりの商品の場合は「1セット」と表示
  if (item.item_name.includes("のぼり(6枚1セット)") || item.item_name.includes("のぼり(10枚1セット)")) {
    return "1セット"
  }

  // 特定の販促グッズの場合は、数量をそのまま表示
  if (specialPromotionalItems.some((name) => item.item_name.includes(name))) {
    return `${item.quantity}枚`
  }

  // コースシールの場合
  if (isCourseSticker(item.item_name)) {
    return `${item.quantity}枚`
  }

  // その他の商品は従来通りの処理
  return `${item.quantity}${item.item_name.includes("液剤") ? "本" : "枚"}`
}

type StoreInfo = {
  id: string
  name: string
  email: string
  address?: string
  phone?: string
  zipCode?: string
  manager?: string
}

// COMING SOON画像のURL
const COMING_SOON_IMAGE_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/0005720_coming-soon-page_550-GJuRp7f7JXrp3ZSP6hK2ihMLTP2abk.webp"

// デフォルトのプレースホルダー画像のURL
const DEFAULT_PLACEHOLDER_URL = "/placeholder.svg"

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
const fourDaysDeliveryItems = ["スプシャン", "スプワックス", "スプコート", "スプセラ", "スプタイヤ", "ピッカークロス"]

// 納期の計算
const calculateDeliveryDate = (leadTime: string, category: string, itemName: string) => {
  // 3週間後の納期を表示する商品
  if (threeWeeksDeliveryItems.some((item) => itemName.includes(item))) {
    const deliveryDate = addWeeks(new Date(), 3)
    return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
  }

  // 4日後の納期を表示する商品（3日後から4日に変更）
  if (fourDaysDeliveryItems.some((item) => itemName.includes(item))) {
    const deliveryDate = addDays(new Date(), 4)
    return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
  }

  // カテゴリーに基づいた納期計算
  if (category === "販促グッズ") {
    // 販促グッズは約3週間
    const deliveryDate = addWeeks(new Date(), 3)
    return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
  } else if (category === "液剤") {
    // 液剤は約4日（3日から4日に変更）
    const deliveryDate = addDays(new Date(), 4)
    return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
  }

  // その他のカテゴリーは従来通りの計算
  if (leadTime === "即日") return "即日出荷"
  const weeks = Number(leadTime.match(/\d+/)?.[0] || "0")
  const deliveryDate = addWeeks(new Date(), weeks)
  return `${format(deliveryDate, "yyyy年MM月dd日", { locale: ja })}頃`
}

// 商品価格の計算（修正版）
const calculateItemTotal = (item: CartItem) => {
  // 利用規約の価格設定
  if (item.item_name.includes("利用規約")) {
    if (item.selectedQuantity === 500) {
      return 10000
    } else if (item.selectedQuantity === 1000) {
      return 20000
    } else if (item.selectedQuantity === 2500) {
      // 新店舗パックの利用規約は2500枚
      return 25000 // 仮の価格、スプレッドシートで設定されている価格に合わせる
    }
    return 10000 // デフォルト
  }

  // お年賀の価格設定
  if (item.item_name.includes("お年賀")) {
    return 25000
  }

  // サブスクメンバーズカードの価格設定
  if (item.item_name.includes("サブスクメンバーズカード")) {
    if (item.selectedQuantity === 1000) {
      return 36080
    } else if (item.selectedQuantity === 2000) {
      return 60000
    } else if (item.selectedQuantity === 3000) {
      return 84000
    }
    return 36080 // デフォルト
  }

  // コースシールの価格設定
  if (isCourseSticker(item.item_name)) {
    const price = Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
    return price
  }

  // その他の特定の販促グッズの場合
  if (specialPromotionalItems.some((name) => item.item_name.includes(name))) {
    // その他の販促グッズは選択された数量に対応する固定価格をそのまま使用
    return Number(String(item.item_price).replace(/[^0-9.-]+/g, ""))
  }

  // アパレル商品の場合
  if (isApparelItem(item.item_name)) {
    const price =
      typeof item.item_price === "string" ? Number(item.item_price.replace(/[^0-9.-]+/g, "")) : Number(item.item_price)
    return price * item.quantity
  }

  // その他の商品の場合
  else {
    const price =
      typeof item.item_price === "string" ? Number(item.item_price.replace(/[^0-9.-]+/g, "")) : Number(item.item_price)
    return price * item.quantity
  }
}

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [shippingMethod, setShippingMethod] = useState("standard")
  const [orderError, setOrderError] = useState("")
  const [products, setProducts] = useState<any[]>([]) // 商品データを保持するstate
  const [deliveryDateRange, setDeliveryDateRange] = useState<string>("データなし")

  // 最早・最遅の納期を計算する関数
  const calculateDeliveryDateRange = (items: CartItem[]) => {
    if (items.length === 0) return "データなし"

    const deliveryDates = items.map((item) => {
      // 3週間後の納期を表示する商品
      if (threeWeeksDeliveryItems.some((name) => item.item_name.includes(name))) {
        return addWeeks(new Date(), 3) // 3週間後
      }

      // 4日後の納期を表示する商品（3日後から4日後に変更）
      if (fourDaysDeliveryItems.some((name) => item.item_name.includes(name))) {
        return addDays(new Date(), 4) // 4日後
      }

      // カテゴリーに基づいた日付計算
      if (item.item_category === "販促グッズ") {
        return addWeeks(new Date(), 3) // 3週間後
      } else if (item.item_category === "液剤") {
        return addDays(new Date(), 4) // 4日後（3日から4日に変更）
      }

      // その他のカテゴリーは従来通りの計算
      if (item.lead_time === "即日") return new Date()
      const weeks = Number(item.lead_time.match(/\d+/)?.[0] || "0")
      return addWeeks(new Date(), weeks)
    })

    const earliestDate = new Date(Math.min(...deliveryDates.map((d) => d.getTime())))
    const latestDate = new Date(Math.max(...deliveryDates.map((d) => d.getTime())))

    if (earliestDate.getTime() === latestDate.getTime()) {
      return `${format(earliestDate, "yyyy年MM月dd日", { locale: ja })}頃`
    }

    return `${format(earliestDate, "yyyy年MM月dd日", { locale: ja })} - ${format(latestDate, "yyyy年MM月dd日", { locale: ja })}頃`
  }

  // カートデータとストア情報の取得
  useEffect(() => {
    // クライアントサイドでのみlocalStorageにアクセス
    const savedCart = typeof window !== "undefined" ? localStorage.getItem("cart") : null
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)

        // 既存のカートアイテムの価格を修正
        const correctedCart = parsedCart.map((item: CartItem) => {
          // 利用規約の価格修正
          if (item.item_name.includes("利用規約")) {
            if (item.selectedQuantity === 500) {
              return { ...item, item_price: "10000" }
            } else if (item.selectedQuantity === 1000) {
              return { ...item, item_price: "20000" }
            }
            return { ...item, item_price: "10000" }
          }
          // お年賀の価格修正
          else if (item.item_name.includes("お年賀")) {
            return { ...item, item_price: "25000" }
          }
          // サブスクメンバーズカードの価格修正
          else if (item.item_name.includes("サブスクメンバーズカード")) {
            if (item.selectedQuantity === 1000) {
              return { ...item, item_price: "36080" }
            } else if (item.selectedQuantity === 2000) {
              return { ...item, item_price: "60000" }
            } else if (item.selectedQuantity === 3000) {
              return { ...item, item_price: "84000" }
            }
            return { ...item, item_price: "36080" }
          }
          return item
        })

        setCartItems(correctedCart)

        // 修正されたカートをローカルストレージに保存
        if (typeof window !== "undefined") {
          localStorage.setItem("cart", JSON.stringify(correctedCart))
        }

        // 納期範囲を計算
        setDeliveryDateRange(calculateDeliveryDateRange(correctedCart))
      } catch (e) {
        console.error("Failed to parse cart data:", e)
        setCartItems([])
      }
    }

    // ストア情報の取得
    const savedStoreInfo = typeof window !== "undefined" ? localStorage.getItem("storeInfo") : null
    if (savedStoreInfo) {
      try {
        const parsedStoreInfo = JSON.parse(savedStoreInfo)
        setStoreInfo(parsedStoreInfo)
        // ストア情報の詳細を取得
        fetchStoreDetails(parsedStoreInfo.id)
      } catch (e) {
        console.error("Failed to parse store info:", e)
        fetchStoreInfo() // フォールバック：APIからストア情報を取得
      }
    } else {
      fetchStoreInfo()
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
          const savedCart = typeof window !== "undefined" ? localStorage.getItem("cart") : null
          if (savedCart) {
            const items = JSON.parse(savedCart)
            const updatedItems = items.map((item: CartItem) => {
              // 商品名で一致する商品を検索
              const matchingProduct = data.find((product) => product.name === item.item_name)
              if (matchingProduct && matchingProduct.imageUrl) {
                return {
                  ...item,
                  imageUrl: convertGoogleDriveUrl(matchingProduct.imageUrl),
                }
              }
              return item
            })
            setCartItems(updatedItems)
            // 納期範囲を計算
            setDeliveryDateRange(calculateDeliveryDateRange(updatedItems))

            if (typeof window !== "undefined") {
              localStorage.setItem("cart", JSON.stringify(updatedItems))
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  // ストア詳細情報の取得
  const fetchStoreDetails = async (storeId: string) => {
    try {
      const response = await fetch(`/api/sheets?sheet=store_info`)

      if (!response.ok) {
        const storeName = typeof window !== "undefined" ? localStorage.getItem("storeName") : null
        const storeEmail = typeof window !== "undefined" ? localStorage.getItem("storeEmail") : null
        setStoreInfo({ id: storeId, name: storeName || "不明な店舗", phone: "", zipCode: "", address: "", email: storeEmail || "" })
        return
      }

      const data = await response.json()

      if (data && data.length > 0) {
        // store_infoのレスポンスはオブジェクト形式: {id, name, phone, postalCode, address, email, password}
        const storeData = data.find((store: any) => store.id === storeId || store.email === storeId)

        if (storeData) {
          setStoreInfo({
            id: storeData.id,
            name: storeData.name,
            phone: storeData.phone,
            zipCode: storeData.postalCode,
            address: storeData.address,
            email: storeData.email,
          })
        } else {
          const storeName = typeof window !== "undefined" ? localStorage.getItem("storeName") : null
          const storeEmail = typeof window !== "undefined" ? localStorage.getItem("storeEmail") : null
          setStoreInfo({ id: storeId, name: storeName || "不明な店舗", phone: "", zipCode: "", address: "", email: storeEmail || "" })
        }
      }
    } catch (error) {
      console.error("Error fetching store details:", error)
      const storeName = typeof window !== "undefined" ? localStorage.getItem("storeName") : null
      const storeEmail = typeof window !== "undefined" ? localStorage.getItem("storeEmail") : null
      setStoreInfo({ id: storeId, name: storeName || "不明な店舗", phone: "", zipCode: "", address: "", email: storeEmail || "" })
    }
  }

  // ストア情報の取得（フォールバック）
  const fetchStoreInfo = async () => {
    try {
      const response = await fetch("/api/sheets?sheet=store_info")
      const data = await response.json()

      if (data && data.length > 0) {
        const store = data[0]
        setStoreInfo({
          id: store.id,
          name: store.name,
          phone: store.phone,
          zipCode: store.postalCode,
          address: store.address,
          email: store.email,
        })
      }
    } catch (error) {
      console.error("Error fetching store info:", error)
    }
  }

  // 商品画像の取得
  const getProductImage = (item: CartItem) => {
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

  // 単位を取得する関数
  const getUnit = (itemName: string) => {
    // 特定の販促グッズの場合は「枚」を返す
    if (specialPromotionalItems.some((name) => itemName.includes(name))) {
      return "枚"
    }
    return isApparelItem(itemName) ? "枚" : "個"
  }

  // 小計の計算
  const subtotal = cartItems.reduce((total, item) => {
    return total + calculateItemTotal(item)
  }, 0)

  // アパレル商品の送料計算
  const hasApparelItems = cartItems.some((item) => isApparelItem(item.item_name))
  const shippingFee = hasApparelItems ? 1000 : 0

  // 税金の計算（10%、小数点以下切り下げ）
  const tax = Math.floor(subtotal * 0.1)
  // 合計金額の計算（税込み + 送料）
  const totalAmount = subtotal + tax + shippingFee

  // 注文の確定（アパレル制限を撤廃）
  const handleSubmitOrder = async () => {
    if (!storeInfo) {
      setOrderError("ストア情報が取得できませんでした。")
      return
    }

    if (cartItems.length === 0) {
      setOrderError("カートに商品がありません。")
      return
    }

    setLoading(true)
    setOrderError("")

    try {
      // スプレッドシートに発注データを保存
      const response = await fetch("/api/save-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartItems,
          storeInfo,
          shippingMethod,
          totalAmount, // 税込み + 送料の合計金額
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "発注の保存に失敗しました")
      }

      // 発注番号をセッションストレージに保存（発注完了画面で表示するため）
      if (typeof window !== "undefined") {
        sessionStorage.setItem("orderNumber", data.orderNumber)
        // カートをクリア
        localStorage.removeItem("cart")
      }

      // 発注完了画面へリダイレクト
      router.push("/order-complete")
    } catch (error) {
      console.error("Order submission error:", error)
      setOrderError(error instanceof Error ? error.message : "発注処理中にエラーが発生しました")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-white mr-4 hover:bg-white/10"
              onClick={() => router.push("/cart")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                発注確認
                <span className="text-blue-200 ml-2 text-lg font-normal">({cartItems.length}点)</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* 配送先情報 */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Truck className="mr-2 h-5 w-5 text-blue-600" />
                  配送先情報
                </h2>
                <Separator className="mb-4" />

                {storeInfo ? (
                  <div className="space-y-4">
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">店舗名</Label>
                      <p className="font-medium">{storeInfo.name}</p>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">郵便番号</Label>
                      <p className="font-medium">{storeInfo.zipCode || "郵便番号を取得中..."}</p>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">配送先住所</Label>
                      <p className="font-medium">{storeInfo.address || "住所情報を取得中..."}</p>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">電話番号</Label>
                      <p className="font-medium">{storeInfo.phone || "電話番号情報を取得中..."}</p>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">メールアドレス</Label>
                      <p className="font-medium">{storeInfo.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-gray-500">店舗情報を読み込み中...</div>
                )}
              </CardContent>
            </Card>

            {/* 配送方法 */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                  配送方法
                </h2>
                <Separator className="mb-4" />

                <RadioGroup defaultValue="standard" value={shippingMethod} onValueChange={setShippingMethod}>
                  <div className="flex items-start space-x-2 p-3 rounded border hover:bg-gray-50 transition-colors">
                    <RadioGroupItem value="standard" id="standard" />
                    <div className="grid gap-1 flex-1">
                      <Label htmlFor="standard" className="font-medium">
                        標準配送
                      </Label>
                      <p className="text-sm text-muted-foreground">おおよその到着日: {deliveryDateRange}</p>
                      <p className="text-sm text-muted-foreground">
                        {hasApparelItems ? "アパレル商品の送料: ¥1,000" : "送料無料"}
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {hasApparelItems && (
                  <Alert className="mt-4 bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 text-sm">
                      アパレル商品には別途送料1,000円がかかります。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 注文内容 */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">注文内容</h2>
                <Separator className="mb-4" />

                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">カートに商品がありません</div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4 py-3 border-b last:border-0">
                      <div className="flex-shrink-0 w-16 h-16 relative">
                        <Image
                          src={getProductImage(item) || "/placeholder.svg"}
                          alt={item.item_name}
                          fill
                          className="object-contain rounded"
                          onError={(e) => {
                            console.error(`Error loading image for ${item.item_name}, using fallback`)
                            e.currentTarget.src = COMING_SOON_IMAGE_URL
                          }}
                        />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between">
                          <h3 className="font-medium">{item.item_name}</h3>
                          <p className="font-semibold">¥{calculateItemTotal(item).toLocaleString()}</p>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                          {item.selectedColor && <p>カラー: {item.selectedColor}</p>}
                          {item.selectedSize && <p>サイズ: {item.selectedSize}</p>}
                          <p>数量: {formatQuantity(item)}</p>
                          <p className="text-green-600">
                            納期: {calculateDeliveryDate(item.lead_time, item.item_category, item.item_name)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* 注文サマリー */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">注文サマリー</h2>
                <Separator className="mb-4" />

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">小計</span>
                    <span>¥{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">消費税 (10%)</span>
                    <span>¥{tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">配送料</span>
                    <span>¥{shippingFee.toLocaleString()}</span>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex justify-between font-bold text-lg">
                    <span>合計（税込）</span>
                    <span>¥{totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {orderError && (
                  <Alert className="mt-4 bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700 text-sm">{orderError}</AlertDescription>
                  </Alert>
                )}

                <div className="mt-6 space-y-4">
                  <p className="text-sm text-gray-600">おおよその到着日: {deliveryDateRange}</p>
                  <Button
                    className="w-full text-white bg-blue-600 hover:bg-blue-700"
                    onClick={handleSubmitOrder}
                    disabled={loading || cartItems.length === 0}
                  >
                    {loading ? "処理中..." : "発注を確定する"}
                  </Button>
                  <Button variant="outline" className="w-full bg-transparent" onClick={() => router.push("/cart")}>
                    カートに戻る
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
