"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Search, LogOut, Package } from "lucide-react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

// 部品アイテムの型定義
type MachineItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  imageUrl?: string // 画像URLを追加
}

// カートアイテムの型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
  imageUrl?: string // 画像URLを追加
}

// 画像URLの代替形式を試す関数
const tryAlternativeImageUrl = (originalUrl: string): string[] => {
  if (!originalUrl || !originalUrl.includes("drive.google.com")) {
    return [originalUrl]
  }

  const fileIdMatch = originalUrl.match(/\/d\/([^/]+)/)
  if (!fileIdMatch || !fileIdMatch[1]) {
    return [originalUrl]
  }

  const fileId = fileIdMatch[1]

  // 複数の代替URL形式を返す
  return [
    `https://lh3.googleusercontent.com/d/${fileId}`, // Google Photos形式
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`, // サムネイル形式
    `https://drive.google.com/uc?export=view&id=${fileId}`, // 元の形式
    originalUrl, // 元のURL
  ]
}

export default function PartsPage() {
  const router = useRouter()
  const [machineItems, setMachineItems] = useState<MachineItem[]>([])
  const [filteredItems, setFilteredItems] = useState<MachineItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [storeNames, setStoreNames] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({})
  const [cart, setCart] = useState<PartsCartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<{ [key: string]: number }>({}) // 画像エラー追跡

  // データを取得
  useEffect(() => {
    const fetchMachineItems = async () => {
      setIsLoading(true)
      try {
        console.log("Fetching machine items from API...")
        const response = await fetch("/api/machine-items")
        if (!response.ok) {
          throw new Error(`Failed to fetch machine items: ${response.status}`)
        }
        const data = await response.json()

        console.log("Fetched machine items:", data.length, "items")
        console.log("Sample items:", data.slice(0, 3))

        setMachineItems(data)
        setFilteredItems(data)

        // カテゴリーと店舗名の一覧を抽出（型安全な方法）
        const uniqueCategories = [...new Set(data.map((item: MachineItem) => item.category))] as string[]
        const uniqueStoreNames = [...new Set(data.map((item: MachineItem) => item.storeName))] as string[]

        setCategories(uniqueCategories.filter((cat) => cat && cat.trim() !== ""))
        setStoreNames(uniqueStoreNames.filter((store) => store && store.trim() !== ""))

        // 初期数量を設定
        const initialQuantities: { [key: string]: number } = {}
        data.forEach((item: MachineItem) => {
          initialQuantities[item.id] = 1
        })
        setQuantities(initialQuantities)
      } catch (error) {
        console.error("Error fetching machine items:", error)
      } finally {
        setIsLoading(false)
      }
    }

    // カート情報を取得
    const savedCart = localStorage.getItem("partsCart")
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse parts cart data:", e)
      }
    }

    fetchMachineItems()
  }, [])

  // フィルタリング処理
  useEffect(() => {
    let filtered = machineItems

    // 店舗名でフィルタリング
    if (selectedStore !== "all") {
      filtered = filtered.filter((item) => item.storeName === selectedStore)
    }

    // カテゴリーでフィルタリング
    if (selectedCategory !== "all") {
      filtered = filtered.filter((item) => item.category === selectedCategory)
    }

    // 検索クエリでフィルタリング
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    setFilteredItems(filtered)
  }, [machineItems, selectedStore, selectedCategory, searchQuery])

  // 数量変更
  const handleQuantityChange = (itemId: string, quantity: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: quantity,
    }))
  }

  // 画像エラーハンドリング（代替URLを試す）
  const handleImageError = (item: MachineItem, e: React.SyntheticEvent<HTMLImageElement>) => {
    const currentErrorCount = imageErrors[item.id] || 0
    const alternativeUrls = tryAlternativeImageUrl(item.imageUrl || "")

    console.error(`Error loading image for ${item.itemName} (attempt ${currentErrorCount + 1})`)
    console.error(`Failed URL: ${e.currentTarget.src}`)

    // 次の代替URLを試す
    if (currentErrorCount < alternativeUrls.length - 1) {
      const nextUrl = alternativeUrls[currentErrorCount + 1]
      console.log(`Trying alternative URL: ${nextUrl}`)

      setImageErrors((prev) => ({
        ...prev,
        [item.id]: currentErrorCount + 1,
      }))

      e.currentTarget.src = nextUrl
    } else {
      // すべての代替URLが失敗した場合、画像を非表示にしてアイコンを表示
      console.log(`All alternative URLs failed for ${item.itemName}, showing fallback icon`)
      e.currentTarget.style.display = "none"
      const fallbackIcon = e.currentTarget.parentElement?.querySelector(".fallback-icon") as HTMLElement
      if (fallbackIcon) {
        fallbackIcon.style.display = "flex"
      }
    }
  }

  // カートに追加する処理で画像URLも含める
  const addToCart = (item: MachineItem) => {
    const quantity = quantities[item.id] || 1

    const cartItem: PartsCartItem = {
      id: item.id,
      storeName: item.storeName,
      category: item.category,
      itemName: item.itemName,
      quantity,
      imageUrl: item.imageUrl, // 画像URLを追加
    }

    const updatedCart = [...cart, cartItem]
    setCart(updatedCart)
    localStorage.setItem("partsCart", JSON.stringify(updatedCart))

    // 成功メッセージ（簡易版）
    alert(`${item.itemName} を ${quantity}個 カートに追加しました`)
  }

  // 画像のソースURLを取得する関数
  const getImageSrc = (item: MachineItem): string => {
    if (!item.imageUrl) return "/placeholder.svg"

    const alternativeUrls = tryAlternativeImageUrl(item.imageUrl)
    const errorCount = imageErrors[item.id] || 0

    return alternativeUrls[errorCount] || "/placeholder.svg"
  }

  return (
    <div className="min-h-screen flex flex-col bg-yellow-50">
      {/* ヘッダー - 黄色ベース */}
      <header className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black py-3 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">
                SPLASH'N'GO!部品
                <span className="text-yellow-800 ml-2 text-lg font-normal">アイテム一覧</span>
              </h1>
              <p className="text-yellow-800 text-sm mt-1">洗車機部品発注システム</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                className="bg-black/10 hover:bg-black/20 text-black rounded-full p-2 h-10 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                onClick={() => {
                  localStorage.removeItem("partsCart")
                  router.push("/login")
                }}
              >
                <LogOut className="h-5 w-5 mr-2" />
                <span className="text-sm">ログアウト</span>
              </Button>
              <Button
                className="bg-black/10 hover:bg-black/20 text-black rounded-full p-3 h-12 w-12 backdrop-blur-sm transition-all duration-200 hover:scale-105 relative group"
                onClick={() => router.push("/parts-cart")}
              >
                <ShoppingCart className="h-6 w-6" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-in zoom-in duration-200">
                    {cart.length}
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
              placeholder="部品名やカテゴリで検索..."
              className="pl-10 pr-4 py-3 rounded-full border-yellow-300 shadow-sm focus:ring-yellow-500 focus:border-yellow-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* フィルター */}
        <div className="mb-8 flex flex-wrap gap-4 justify-center">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">店舗名</label>
            <Select value={selectedStore} onValueChange={(value) => setSelectedStore(value)}>
              <SelectTrigger className="w-48 border-yellow-300 focus:ring-yellow-500">
                <SelectValue placeholder="すべての店舗" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての店舗</SelectItem>
                {storeNames
                  .filter((store) => store && store.trim() !== "")
                  .map((store) => (
                    <SelectItem key={store} value={store}>
                      {store}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value)}>
              <SelectTrigger className="w-48 border-yellow-300 focus:ring-yellow-500">
                <SelectValue placeholder="すべてのカテゴリー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリー</SelectItem>
                {categories
                  .filter((category) => category && category.trim() !== "")
                  .map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ローディング表示 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          </div>
        ) : (
          <>
            {/* 部品グリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow border border-yellow-200 rounded-xl bg-white"
                >
                  {/* 部品画像表示エリア */}
                  <div className="relative pt-[75%] bg-yellow-50 border-2 border-yellow-300 flex items-center justify-center">
                    {item.imageUrl && item.imageUrl.trim() !== "" ? (
                      <Image
                        src={getImageSrc(item) || "/placeholder.svg"}
                        alt={item.itemName}
                        fill
                        className="object-contain p-2"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        unoptimized={true} // Google Drive画像の場合は最適化を無効にする
                        onError={(e) => handleImageError(item, e)}
                        onLoad={() => {
                          console.log(`Successfully loaded image for ${item.itemName}`)
                        }}
                      />
                    ) : null}

                    {/* フォールバック用のPackageアイコン */}
                    <div
                      className={`absolute inset-0 flex items-center justify-center fallback-icon ${
                        item.imageUrl && item.imageUrl.trim() !== "" ? "hidden" : "flex"
                      }`}
                    >
                      <Package className="h-16 w-16 text-yellow-600" />
                    </div>
                  </div>

                  <Badge className="absolute top-2 left-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-full z-10">
                    {item.category}
                  </Badge>

                  <CardContent className="flex-grow p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.itemName}</h3>
                    <p className="text-sm text-gray-600 mb-2">店舗: {item.storeName}</p>
                    {/* デバッグ用：画像URLを表示 */}
                    {process.env.NODE_ENV === "development" && (
                      <p className="text-xs text-gray-400 mb-2 truncate">URL: {item.imageUrl || "なし"}</p>
                    )}

                    {/* 数量選択 */}
                    <div className="mb-3">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">数量</label>
                      <Select
                        value={String(quantities[item.id] || 1)}
                        onValueChange={(value) => handleQuantityChange(item.id, Number(value))}
                      >
                        <SelectTrigger className="w-full border-yellow-300 focus:ring-yellow-500">
                          <SelectValue placeholder="数量を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(10)].map((_, i) => (
                            <SelectItem key={`${item.id}-qty-${i + 1}`} value={String(i + 1)}>
                              {i + 1}個
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0">
                    <Button
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black rounded-md py-2 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                      onClick={() => addToCart(item)}
                    >
                      カートに追加
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* 部品が見つからない場合 */}
            {filteredItems.length === 0 && !isLoading && (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-yellow-200">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">部品が見つかりませんでした</h3>
                <p className="text-gray-500 mb-4">検索条件を変更するか、フィルターをリセットしてください</p>
                <Button
                  variant="outline"
                  className="rounded-full px-6 border-yellow-300 text-yellow-700 hover:bg-yellow-50 bg-transparent"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory("all")
                    setSelectedStore("all")
                  }}
                >
                  すべての部品を表示
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
            <p>&copy; SPLASH'N'GO! Parts Store. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
