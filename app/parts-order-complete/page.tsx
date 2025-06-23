"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Package, ArrowRight, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PartsOrderCompletePage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<any>(null)

  useEffect(() => {
    // セッションストレージから発注番号を取得
    const savedOrderNumber = sessionStorage.getItem("partsOrderNumber")
    if (savedOrderNumber) {
      setOrderNumber(savedOrderNumber)
      // 使用後は削除
      sessionStorage.removeItem("partsOrderNumber")
    }

    // 発注データを取得（発注書生成用）
    const savedOrderData = sessionStorage.getItem("partsOrderData")
    if (savedOrderData) {
      try {
        setOrderData(JSON.parse(savedOrderData))
        // 使用後は削除
        sessionStorage.removeItem("partsOrderData")
      } catch (e) {
        console.error("Failed to parse order data:", e)
      }
    }
  }, [])

  // 発注書をダウンロード
  const downloadPurchaseOrder = async (format: "pdf" | "excel") => {
    if (!orderData) {
      alert("発注データが見つかりません")
      return
    }

    try {
      const response = await fetch("/api/generate-purchase-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...orderData,
          orderNumber, // 実際の発注番号を使用
          format,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate purchase order")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `purchase_order_${orderNumber}.${format === "pdf" ? "pdf" : "xlsx"}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading purchase order:", error)
      alert("発注書のダウンロードに失敗しました")
    }
  }

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
            </div>

            {/* 発注書ダウンロードセクション */}
            {orderData && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-center">
                  <FileText className="h-5 w-5 mr-2" />
                  発注書ダウンロード
                </h3>
                <p className="text-sm text-gray-600 mb-4">発注書をPDFまたはExcel形式でダウンロードできます</p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => downloadPurchaseOrder("pdf")}
                    className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    PDF形式
                  </Button>
                  <Button
                    onClick={() => downloadPurchaseOrder("excel")}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Excel形式
                  </Button>
                </div>
              </div>
            )}

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
