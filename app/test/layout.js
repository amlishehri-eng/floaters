// The integration test panel keeps the older Geist look.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export default function TestLayout({ children }) {
  return <div className={`${GeistSans.variable} ${GeistMono.variable} font-sans flex flex-1 flex-col`}>{children}</div>;
}
