"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export default function OrderCompletePage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  useEffect(() => {
    // セッションストレージから発注番号を取得
    const savedOrderNumber = sessionStorage.getItem("orderNumber")
    if (savedOrderNumber) {
      setOrderNumber(savedOrderNumber)
      // 使用後にクリア
      sessionStorage.removeItem("orderNumber")
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold tracking-tight">
              SPLASH'N'GO!
              <span className="text-blue-200 ml-2 text-lg font-normal">発注完了</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg border-gray-200">
          <CardContent className="pt-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">発注が完了しました</h1>
            <p className="text-muted-foreground mb-6">ご発注ありがとうございました</p>
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <p className="text-sm text-blue-600 mb-1">発注番号</p>
              <p className="font-bold text-2xl text-blue-700">{orderNumber || "ORD-00000"}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              発注内容の確認メールを送信しました。
              <br />
              発注状況は発注履歴からご確認いただけます。
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 p-6">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => router.push("/order-history")}
            >
              発注履歴を確認する
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push("/products")}>
              備品一覧に戻る
            </Button>
          </CardFooter>
        </Card>
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

