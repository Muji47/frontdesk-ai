"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function GlobalWidgetLauncher() {
  const pathname = usePathname();

  useEffect(() => {
    // If navigating to dashboard or test embed, remove floating widget
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/test-embed")) {
      const existingWidget = document.getElementById("echo-receptionist-widget");
      if (existingWidget) existingWidget.remove();
      const existingScript = document.getElementById("echo-widget-script");
      if (existingScript) existingScript.remove();
      return;
    }

    // If widget not present, inject script
    if (!document.getElementById("echo-receptionist-widget")) {
      const existingScript = document.getElementById("echo-widget-script");
      if (existingScript) existingScript.remove();

      const script = document.createElement("script");
      script.id = "echo-widget-script";
      script.src = "/widget.js";
      script.setAttribute("data-org", "org_demo_101");
      script.async = true;
      document.body.appendChild(script);
    }
  }, [pathname]);

  return null;
}

