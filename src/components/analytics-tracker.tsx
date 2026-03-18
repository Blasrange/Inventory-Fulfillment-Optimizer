"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      // Construir la URL completa con los parámetros de búsqueda
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      
      // Enviar pageview a Google Analytics
      window.gtag("event", "page_view", {
        page_path: url,
        page_title: document.title,
        page_location: window.location.href,
      });
      
      console.log(`📊 Pageview enviado: ${url}`); // Para debugging
    }
  }, [pathname, searchParams]);

  return null;
}