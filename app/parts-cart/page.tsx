"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Trash2, ArrowLeft, ShoppingBag, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// カートアイテムの型定義
type PartsCartItem = {
  id: string
  storeName: string
  category: string
  itemName: string
  quantity: number
}

export default function PartsCartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<PartsCartItem[]>([])
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  useEffect(() => {
    const savedCart = localStorage.getItem("partsCart")
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (e) {
        console.error("Failed to parse parts cart data:", e)
      }
    }
  }, [])

  // 商品の削除
  const removeItem = (itemId: string) => {
    const updatedCart = cartItems.filter((item) => item.id !== itemId)
    setCartItems(updatedCart)
    localStorage.setItem("partsCart", JSON.stringify(updatedCart))
  }

  // 数量変更
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    const updatedCart = cartItems.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item))
    setCartItems(updatedCart)
    localStorage.setItem("partsCart", JSON.stringify(updatedCart))
  }

  // 注文処理
  const handleCheckout = () => {
    router.push("/parts-checkout")
  }

  return (
    <div className="min-h-screen bg-yellow-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black py-4 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">部品カート</h1>
            <Button
              variant="outline"
              size="sm"
              className="text-black border-black hover:bg-black hover:text-yellow-400"
              onClick={() => {
                localStorage.removeItem("partsCart")
                setCartItems([])
              }}
            >
              カートをクリア
            </Button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6 flex items-center text-yellow-700 hover:text-yellow-800"
          onClick={() => router.push("/parts")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          部品一覧に戻る
        </Button>

        {cartItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="text-5xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold mb-2">カートは空です</h3>
            <p className="text-gray-500 mb-6">部品を追加してください</p>
            <Button onClick={() => router.push("/parts")} className="px-6 bg-yellow-500 hover:bg-yellow-600 text-black">
              部品一覧に戻る
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* カート商品リスト */}
            <div className="lg:col-span-2">
              <Card className="bg-white border-yellow-200">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">カート内の部品 ({cartItems.length}点)</h2>

                  {cartItems.map((item) => (
                    <div key={item.id} className="mb-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative h-24 w-24 bg-yellow-50 rounded-md flex-shrink-0 border-2 border-yellow-300 flex items-center justify-center">
                          <Package className="h-12 w-12 text-yellow-600" />
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between">
                            <h3 className="font-medium">{item.itemName}</h3>
                          </div>

                          {/* 詳細情報 */}
                          <div className="text-sm text-gray-500 mb-2">
                            <span className="mr-4">カテゴリー: {item.category}</span>
                            <span className="mr-4">店舗: {item.storeName}</span>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-2">
                              <span>数量:</span>
                              <select
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                                className="border border-yellow-300 rounded px-2 py-1 text-sm focus:ring-yellow-500 focus:border-yellow-500"
                              >
                                {[...Array(10)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}個
                                  </option>
                                ))}
                              </select>
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
              <Card className="sticky top-24 bg-white border-yellow-200">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">注文サマリー</h2>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">合計部品数</span>
                      <span>{cartItems.reduce((total, item) => total + item.quantity, 0)}個</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>総アイテム数</span>
                      <span>{cartItems.length}種類</span>
                    </div>

                    <Button
                      className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-black"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? (
                        <span className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
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
            <p>&copy; SPLASH'N'GO! Parts Store. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
