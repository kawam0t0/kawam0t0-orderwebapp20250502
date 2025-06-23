"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Package, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PartsOrderCompletePage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  useEffect(() => {
    // セッションストレージから発注番号を取得
    const savedOrderNumber = sessionStorage.getItem("partsOrderNumber")
    if (savedOrderNumber) {
      setOrderNumber(savedOrderNumber)
      // 使用後は削除
      sessionStorage.removeItem("partsOrderNumber")
    }
  }, [])

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-white border-yellow-200 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">部品発注完了</h1>
              <p className="text-gray-600">部品の発注が正常に完了しました</p>
            </div>

            {orderNumber && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">発注番号</p>
                <p className="text-xl font-bold text-yellow-700">{orderNumber}</p>
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center text-gray-600">
                <Package className="h-5 w-5 mr-2" />
                <span>発注データがシステムに保存されました</span>
              </div>
              <p className="text-sm text-gray-500">
                発注書はダウンロード済みです。必要に応じて再度ダウンロードしてください。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => router.push("/parts")} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                <Package className="h-4 w-4 mr-2" />
                部品一覧に戻る
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("storeInfo")
                  router.push("/login")
                }}
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              >
                ログアウト
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
