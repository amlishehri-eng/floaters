import { Mona_Sans } from "next/font/google";
import "./globals.css";
import "./ff.css";

// Mona Sans (variable width and weight) for the Founders First pages, per design/DESIGN.md.
// Geist is loaded only by the older pages' own layouts (app/proof/(legacy)/layout.js, app/test/layout.js).
const mona = Mona_Sans({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-mona", display: "swap" });

export const metadata = {
  title: "Founders First",
  description: "Tells HTGF which German deep-tech teams to call before anyone writes about them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mona.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
