import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, JWTPayload } from '@/lib/auth'

const protectedPaths = ['/dashboard']
const authPaths = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get token from cookies
  const token = request.cookies.get('auth-token')?.value
  
  let payload: JWTPayload | null = null
  if (token) {
    payload = await verifyToken(token)
  }
  
  // Redirect authenticated users away from auth pages
  if (authPaths.some(path => pathname.startsWith(path)) && payload) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Redirect unauthenticated users to login
  if (protectedPaths.some(path => pathname.startsWith(path)) && !payload) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
}