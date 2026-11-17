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

    // Determine targeted persona for the active route
    let targetOrg = "org_echo_sales";
    if (pathname === "/for/clinic") targetOrg = "org_demo_101";
    else if (pathname === "/for/ecommerce") targetOrg = "org_demo_ecom";
    else if (pathname === "/for/realestate") targetOrg = "org_demo_realestate";
    else if (pathname === "/for/beauty") targetOrg = "org_demo_beauty";

    const currentScript = document.getElementById("echo-widget-script");
    const currentOrg = currentScript?.getAttribute("data-org");

    // If widget not present or persona changed for route, inject script
    if (!document.getElementById("echo-receptionist-widget") || currentOrg !== targetOrg) {
      const existingWidget = document.getElementById("echo-receptionist-widget");
      if (existingWidget) existingWidget.remove();
      if (currentScript) currentScript.remove();

      const script = document.createElement("script");
      script.id = "echo-widget-script";
      script.src = "/widget.js";
      script.setAttribute("data-org", targetOrg);
      script.async = true;
      document.body.appendChild(script);
    }
  }, [pathname]);

  return null;
}

