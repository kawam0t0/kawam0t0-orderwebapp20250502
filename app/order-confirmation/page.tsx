"use client"
import { useRouter } from "next/navigation"
import { CheckCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OrderConfirmationPage() {
  const router = useRouter()

  // 注文番号の生成（実際のアプリでは、APIからの応答で取得）
  const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`

  // 現在の日付から配送予定日を計算（3営業日後）
  const getEstimatedDeliveryDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 3)
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ご注文ありがとうございます！</h1>
            <p className="text-gray-600">注文が正常に処理されました。注文の詳細は以下の通りです。</p>
          </div>

          <div className="border border-gray-200 rounded-md p-6 mb-6">
            <div className="flex justify-between mb-4">
              <span className="text-gray-600">注文番号:</span>
              <span className="font-semibold">{orderNumber}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="text-gray-600">注文日:</span>
              <span>{new Date().toLocaleDateString("ja-JP")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">配送予定日:</span>
              <span>{getEstimatedDeliveryDate()}</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-600 mb-6">注文の確認メールを送信しました。ご確認ください。</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push("/products")}
                className="flex items-center justify-center"
              >
                買い物を続ける
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={() => router.push("/order-history")} className="flex items-center justify-center">
                注文履歴を確認する
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">
            <p>&copy; SPLASH'N'GO!Item Store. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

