import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TripSplit — แบ่งค่าใช้จ่ายทริปโปร่งใส',
  description: 'บริหารค่าใช้จ่ายทริปกับเพื่อน แบ่งบิล อัปโหลดสลิป และเคลียร์เงินได้ในคลิกเดียว',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
