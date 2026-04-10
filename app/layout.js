import "./globals.css"

export const metadata = {
  title: "Mosaic QA Complaint Tracker",
  description: "End-to-end complaint analytics for Man Matters, Be Bodywise & Little Joys",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className="antialiased bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
