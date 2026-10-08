import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultTheme, isTheme, THEME_COOKIE } from "@/lib/theme";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RijSchool Planner",
  description: "Rijschool management / Driving school management",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const c = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(c) ? c : defaultTheme;
  return (
    <html lang={locale} data-theme={theme} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
