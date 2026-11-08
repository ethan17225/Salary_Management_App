import { DM_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata = {
  title: "Payday · paycheque tracker",
  description: "Log every paycheque from every job and see where your income comes from.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%230d7480'/%3E%3Ctext x='16' y='22.5' font-family='system-ui' font-size='18' font-weight='600' fill='white' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E",
  },
};

export const viewport = { themeColor: "#f7f9fa" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

