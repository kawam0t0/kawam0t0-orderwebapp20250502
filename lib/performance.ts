/**
 * 画像URLをサイズに基づいて最適化する
 * @param url 元の画像URL
 * @param width 希望する幅
 * @param height 希望する高さ
 * @returns 最適化された画像URL
 */
export function optimizeImageUrl(url: string, width = 300, height = 300): string {
    // プレースホルダー画像の場合は、サイズパラメータを追加
    if (url.includes("/placeholder.svg")) {
      return `${url}${url.includes("?") ? "&" : "?"}width=${width}&height=${height}`
    }
  
    // Vercel Blob Storage の画像の場合
    if (url.includes("vercel-storage.com")) {
      // すでにクエリパラメータがある場合は、サイズパラメータを追加
      if (url.includes("?")) {
        return `${url}&width=${width}&height=${height}`
      }
      // クエリパラメータがない場合は、新しく追加
      return `${url}?width=${width}&height=${height}`
    }
  
    // その他の画像はそのまま返す
    return url
  }
  
  /**
   * データをメモ化して再利用するためのシンプルなキャッシュ
   */
  export class SimpleCache {
    private static cache: Record<string, { data: any; timestamp: number }> = {}
    private static DEFAULT_TTL = 5 * 60 * 1000 // 5分
  
    /**
     * キャッシュからデータを取得または計算して保存
     * @param key キャッシュキー
     * @param fn データを取得する関数
     * @param ttl キャッシュの有効期限（ミリ秒）
     * @returns 計算またはキャッシュされたデータ
     */
    static async get<T>(key: string, fn: () => Promise<T>, ttl: number = SimpleCache.DEFAULT_TTL): Promise<T> {
      const now = Date.now()
      const cached = SimpleCache.cache[key]
  
      if (cached && now - cached.timestamp < ttl) {
        return cached.data
      }
  
      const data = await fn()
      SimpleCache.cache[key] = { data, timestamp: now }
      return data
    }
  
    /**
     * キャッシュをクリア
     * @param key 特定のキーをクリアする場合（省略可）
     */
    static clear(key?: string): void {
      if (key) {
        delete SimpleCache.cache[key]
      } else {
        SimpleCache.cache = {}
      }
    }
  }
  
  