"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_BRAND = "#4F772D";

function darken(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - 30);
  const g = Math.max(0, ((n >> 8) & 0xff) - 25);
  const b = Math.max(0, (n & 0xff) - 20);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function BrandStyle() {
  const { company } = useAuth();
  const primary = company?.brand_config?.primaryColor ?? DEFAULT_BRAND;
  const dark = darken(primary);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", primary);
    root.style.setProperty("--brand-dark", dark);
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-dark");
    };
  }, [primary, dark]);

  return null;
}
