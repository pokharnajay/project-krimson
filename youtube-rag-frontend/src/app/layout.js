import './globals.css';
import { Inter } from 'next/font/google';
import ProtectedRoute from '@/components/ProtectedRoute';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'YouTube RAG',
  description: 'AI-powered YouTube video Q&A',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </body>
    </html>
  );
}
