"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, Eye, EyeOff, Building, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Store = {
  id: string
  name: string
  email: string
}

type LoginFormProps = {
  initialStores: Store[]
}

export default function LoginForm({ initialStores }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedStoreId, setSelectedStoreId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [formFocus, setFormFocus] = useState<string | null>(null)

  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId)
    const selectedStore = initialStores.find((store) => store.id === storeId)
    if (selectedStore) {
      setEmail(selectedStore.email)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const selectedStore = initialStores.find((store) => store.id === selectedStoreId)
      if (!selectedStore) {
        setError("店舗を選択してください")
        setLoading(false)
        return
      }

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // ログイン成功時に店舗情報をローカルストレージに保存
        localStorage.setItem(
          "storeInfo",
          JSON.stringify({
            id: selectedStore.id,
            name: selectedStore.name,
            email: selectedStore.email,
          }),
        )

        router.push("/products")
      } else {
        setError(data.message || "ログインに失敗しました")
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("ログイン処理中にエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // 管理者ログイン処理を修正
  const handleAdminLogin = async () => {
    setError("")
    setLoading(true)

    try {
      // パスワードが「admin」の場合のみ管理者画面に遷移
      if (password === "admin") {
        router.push("/admin")
      } else {
        setError("管理者ログインに失敗しました")
      }
    } catch (error) {
      console.error("Admin login error:", error)
      setError("管理者ログイン処理中にエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full overflow-hidden rounded-2xl shadow-2xl border-0 bg-white/80 backdrop-blur-sm transition-all duration-300">
      <CardContent className="p-0">
        <div className="p-6 space-y-5">
          {error && (
            <Alert className="bg-red-50 border-red-200 text-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div className={`relative transition-all duration-200 ${formFocus === "store" ? "scale-102" : ""}`}>
                <Label htmlFor="store" className="text-sm font-medium text-gray-700 mb-1 block">
                  店舗を選択
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-5 w-5 text-blue-500" />
                  <Select
                    onValueChange={handleStoreSelect}
                    value={selectedStoreId}
                    onOpenChange={(open) => setFormFocus(open ? "store" : null)}
                  >
                    <SelectTrigger className="w-full pl-10 h-12 border-gray-200 bg-white/90 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                      <SelectValue placeholder="店舗を選択してください" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {initialStores.map((store) => (
                        <SelectItem key={store.id} value={store.id} className="cursor-pointer py-2 hover:bg-blue-50">
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={`relative transition-all duration-200 ${formFocus === "email" ? "scale-102" : ""}`}>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-1 block">
                  メールアドレス
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-blue-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@company.com"
                    className="pl-10 pr-4 h-12 border-gray-200 bg-white/90 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFormFocus("email")}
                    onBlur={() => setFormFocus(null)}
                    required
                    readOnly
                  />
                </div>
              </div>

              <div className={`relative transition-all duration-200 ${formFocus === "password" ? "scale-102" : ""}`}>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-1 block">
                  パスワード
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 h-12 border-gray-200 bg-white/90 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFormFocus("password")}
                    onBlur={() => setFormFocus(null)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium text-lg flex items-center justify-center gap-2 transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-lg"
                disabled={loading || !selectedStoreId}
              >
                {loading ? "ログイン中..." : "ログイン"}
                {!loading && <ArrowRight className="h-5 w-5" />}
              </Button>
            </div>
          </form>
        </div>

        <div className="bg-gray-50 p-4 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-all duration-200"
            onClick={handleAdminLogin}
            disabled={loading}
          >
            管理者ログイン
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

