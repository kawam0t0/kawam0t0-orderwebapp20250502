import { redirect } from "next/navigation"

export default function Home() {
  // ルートページにアクセスした場合はログインページにリダイレクト
  redirect("/login")
}
