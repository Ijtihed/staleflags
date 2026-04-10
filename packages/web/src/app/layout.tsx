import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "staleflags",
  description:
    "Your feature flags served their purpose. staleflags finds the dead code they left behind.",
  metadataBase: new URL("https://staleflags.vercel.app"),
  openGraph: {
    title: "staleflags",
    description:
      "Find dead feature flags and quantify the dead code they create. Cross-environment comparison, dead code quantification, phantom and orphan detection.",
    url: "https://staleflags.vercel.app",
    siteName: "staleflags",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "staleflags",
    description: "Your feature flags served their purpose. staleflags finds the dead code they left behind.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
