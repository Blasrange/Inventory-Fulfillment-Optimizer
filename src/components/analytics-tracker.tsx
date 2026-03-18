"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// Componente interno que usa useSearchParams (envuelto en Suspense aquí mismo)
function AnalyticsTrackerContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      // Construir la URL completa con los parámetros de búsqueda
      const url =
        pathname +
        (searchParams?.toString() ? `?${searchParams.toString()}` : "");

      // Verificar que gtag existe antes de usarlo
      if (typeof window.gtag !== "undefined") {
        window.gtag("event", "page_view", {
          page_path: url,
          page_title: document.title,
          page_location: window.location.href,
        });
      }

      console.log(`📊 Pageview enviado: ${url}`); // Para debugging
    }
  }, [pathname, searchParams]);

  return null;
}

// Componente principal con Suspense incluido
export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerContent />
    </Suspense>
  );
}
