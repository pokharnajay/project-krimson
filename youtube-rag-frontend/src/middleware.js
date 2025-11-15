import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Public paths that don't need auth
  const publicPaths = ['/login'];
  const isPublicPath = publicPaths.includes(pathname);
  
  // Root path - let it handle redirect in component
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Allow public paths
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // For protected paths, let client-side handle it
  // Middleware can't access localStorage
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
