// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  
  // 悪質なボットをブロック
  const badBots = /semrush|ahrefsbot|mj12bot|dotbot|petalbot/i
  if (badBots.test(ua)) {
    return new NextResponse(null, { status: 403 })
  }
  
  return NextResponse.next()
}


