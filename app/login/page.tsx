"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, User, Lock, Eye, EyeOff, Info } from "lucide-react"

interface Store {
  id: string
  name: string
  email: string
  password: string
}

export default function LoginPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [loadingStores, setLoadingStores] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const response = await fetch("/api/sheets?sheet=store_info")
        if (!response.ok) throw new Error("店舗情報の取得に失敗しました")
        const data = await response.json()
        console.log("[v0] Fetched stores:", data)
        setStores(data)
      } catch (err) {
        console.error("[v0] Error fetching stores:", err)
        setError("店舗情報の取得に失敗しました。ネットワーク接続を確認してください。")
      } finally {
        setLoadingStores(false)
      }
    }
    fetchStores()
  }, [])

  // adminはコード内固定（スプレッドシートには存在しない）
  const ADMIN_PASSWORD = "0712"

  const isAdminSelected = selectedStore === "admin"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!selectedStore) {
        setError("店舗を選択してください")
        setLoading(false)
        return
      }

      // 管理者ログイン
      if (isAdminSelected) {
        if (password !== ADMIN_PASSWORD) {
          setError("パスワードが正しくありません")
          setLoading(false)
          return
        }
        localStorage.setItem(
          "storeInfo",
          JSON.stringify({ id: "admin", name: "admin", email: "" })
        )
        router.push("/admin")
        return
      }

      // 通常店舗ログイン
      const store = stores.find((s) => s.name === selectedStore)
      if (!store) {
        setError("店舗を選択してください")
        setLoading(false)
        return
      }

      if (store.email !== email) {
        setError("メールアドレスが正しくありません")
        setLoading(false)
        return
      }

      if (store.password !== password) {
        setError("パスワードが正しくありません")
        setLoading(false)
        return
      }

      localStorage.setItem(
        "storeInfo",
        JSON.stringify({
          id: store.id,
          name: store.name,
          email: store.email,
        })
      )

      router.push("/products")
    } catch (err) {
      setError("ログイン中にエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* ヘッダー */}
          <div style={{ backgroundColor: "#3D55D8" }} className="px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-white tracking-wider">SPLASH'N'GO!</h1>
            <p className="text-blue-200 text-sm mt-1">備品発注システム</p>
          </div>

          {/* フォーム */}
          <div className="px-8 py-8">
            <p className="text-center text-gray-600 mb-6">ログインしてください</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* 店舗選択 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Building2 className="w-4 h-4" style={{ color: "#3D55D8" }} />
                  店舗名
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                >
                  <option value="">店舗を選択してください</option>
                  {/* adminはコード内固定 */}
                  <option value="admin">admin</option>
                  {loadingStores ? (
                    <option disabled>読み込み中...</option>
                  ) : (
                    stores.map((store) => (
                      <option key={store.id} value={store.name}>
                        {store.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* メールアドレス（admin選択時は非表示） */}
              {!isAdminSelected && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4" style={{ color: "#3D55D8" }} />
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              </div>
              )}

              {/* パスワード */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Lock className="w-4 h-4" style={{ color: "#3D55D8" }} />
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ログインボタン */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#3D55D8" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3348C0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3D55D8")}
              >
                {loading ? "ログイン中..." : "ログイン"}
              </button>
            </form>

            {/* 管理者ログイン */}
            <button
              onClick={() => router.push("/admin")}
              className="w-full mt-3 border py-2.5 rounded-lg font-medium transition-colors text-sm"
              style={{ borderColor: "#3D55D8", color: "#3D55D8" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EEF1FC")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              管理者ログイン
            </button>

            {/* お問い合わせ */}
            <div className="mt-5 p-3 bg-blue-50 rounded-lg flex gap-2 text-sm text-gray-600">
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#3D55D8" }} />
              <p>
                ログイン情報がわからない場合は、管理者にお問い合わせください。
                <br />
                <a href="mailto:info@splashbrothers.co.jp" className="hover:underline" style={{ color: "#3D55D8" }}>
                  info@splashbrothers.co.jp
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
