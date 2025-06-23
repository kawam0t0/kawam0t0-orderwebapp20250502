"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Truck, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"

// カートアイテムの型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
}

// 店舗情報の型定義
type StoreInfo = {
  id: string
  name: string
  email: string
}

export default function PartsCheckoutPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<PartsCartItem[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [shippingMethod, setShippingMethod] = useState("air")
  const [loading, setLoading] = useState(false)
  const [orderError, setOrderError] = useState("")

  useEffect(() => {
    // カートデータを取得
    const savedCart = localStorage.getItem("partsCart")
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse parts cart data:", e)
        setCartItems([])
      }
    }

    // 店舗情報を取得
    const savedStoreInfo = localStorage.getItem("storeInfo")
    if (savedStoreInfo) {
      try {
        setStoreInfo(JSON.parse(savedStoreInfo))
      } catch (e) {
        console.error("Failed to parse store info:", e)
      }
    }
  }, [])

  // 注文の確定
  const handleSubmitOrder = async () => {
    if (!storeInfo) {
      setOrderError("ストア情報が取得できませんでした。")
      return
    }

    if (cartItems.length === 0) {
      setOrderError("カートに部品がありません。")
      return
    }

    setLoading(true)
    setOrderError("")

    try {
      // 部品発注データを保存
      const response = await fetch("/api/save-parts-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartItems,
          storeInfo,
          shippingMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "発注の保存に失敗しました")
      }

      // 発注番号と発注データをセッションストレージに保存
      sessionStorage.setItem("partsOrderNumber", data.orderNumber)
      sessionStorage.setItem("partsOrderData", JSON.stringify(data.orderData))

      // カートをクリア
      localStorage.removeItem("partsCart")

      // 発注完了画面へリダイレクト
      router.push("/parts-order-complete")
    } catch (error) {
      console.error("Parts order submission error:", error)
      setOrderError(error instanceof Error ? error.message : "発注処理中にエラーが発生しました")
      setLoading(false)
    }
  }

  const getShippingMethodLabel = (method: string) => {
    switch (method) {
      case "air":
        return "Air shipment (航空便)"
      case "sea":
        return "Sea shipment (船便)"
      case "next_order":
        return "At the same time as the next car wash machine order (次回洗車機注文と同時)"
      default:
        return method
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-yellow-50">
      <header className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black py-3 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-black mr-4 hover:bg-black/10"
              onClick={() => router.push("/parts-cart")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                部品発注確認
                <span className="text-yellow-800 ml-2 text-lg font-normal">({cartItems.length}点)</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* 配送先情報 */}
            <Card className="bg-white border-yellow-200">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Truck className="mr-2 h-5 w-5 text-yellow-600" />
                  配送先情報
                </h2>
                <Separator className="mb-4" />

                {storeInfo ? (
                  <div className="space-y-4">
                    <div className="grid gap-1">
                      <Label className="text-sm text-gray-500">発注者</Label>
                      <p className="font-medium">{storeInfo.name}</p>
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
            <Card className="bg-white border-yellow-200">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Package className="mr-2 h-5 w-5 text-yellow-600" />
                  配送方法
                </h2>
                <Separator className="mb-4" />

                <RadioGroup value={shippingMethod} onValueChange={setShippingMethod}>
                  <div className="flex items-start space-x-2 p-3 rounded border hover:bg-yellow-50 transition-colors">
                    <RadioGroupItem value="air" id="air" />
                    <div className="grid gap-1 flex-1">
                      <Label htmlFor="air" className="font-medium">
                        Air shipment
                      </Label>
                      <p className="text-sm text-muted-foreground">航空便での配送</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-3 rounded border hover:bg-yellow-50 transition-colors">
                    <RadioGroupItem value="sea" id="sea" />
                    <div className="grid gap-1 flex-1">
                      <Label htmlFor="sea" className="font-medium">
                        Sea shipment
                      </Label>
                      <p className="text-sm text-muted-foreground">船便での配送</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-3 rounded border hover:bg-yellow-50 transition-colors">
                    <RadioGroupItem value="next_order" id="next_order" />
                    <div className="grid gap-1 flex-1">
                      <Label htmlFor="next_order" className="font-medium">
                        At the same time as the next car wash machine order
                      </Label>
                      <p className="text-sm text-muted-foreground">次回洗車機注文と同時配送</p>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* 注文内容 */}
            <Card className="bg-white border-yellow-200">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">注文内容</h2>
                <Separator className="mb-4" />

                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">カートに部品がありません</div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4 py-3 border-b last:border-0">
                      <div className="flex-shrink-0 w-16 h-16 relative bg-yellow-50 border-2 border-yellow-300 rounded flex items-center justify-center">
                        <Package className="h-8 w-8 text-yellow-600" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between">
                          <h3 className="font-medium">{item.itemName}</h3>
                          <p className="font-semibold">{item.quantity}個</p>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-1">
                          <p>カテゴリー: {item.category}</p>
                          <p>店舗: {item.storeName}</p>
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
            <Card className="border-yellow-200 bg-white">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">注文サマリー</h2>
                <Separator className="mb-4" />

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">合計部品数</span>
                    <span>{cartItems.reduce((total, item) => total + item.quantity, 0)}個</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">部品種類</span>
                    <span>{cartItems.length}種類</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">配送方法</span>
                    <span className="text-sm">{getShippingMethodLabel(shippingMethod)}</span>
                  </div>
                  <Separator className="my-4" />
                </div>

                {orderError && (
                  <Alert className="mt-4 bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700 text-sm">{orderError}</AlertDescription>
                  </Alert>
                )}

                <div className="mt-6 space-y-4">
                  <Button
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={handleSubmitOrder}
                    disabled={loading || cartItems.length === 0}
                  >
                    {loading ? "処理中..." : "発注を確定する"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    onClick={() => router.push("/parts-cart")}
                  >
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
            <p>&copy; SPLASH'N'GO! Parts Store. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
