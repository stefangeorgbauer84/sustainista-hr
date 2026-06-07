"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm md:hidden"
        aria-label="Menü öffnen"
      >
        <Menu className="h-5 w-5 text-gray-600" strokeWidth={1.5} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <div className="relative flex h-full">
              <Sidebar />
              <button
                onClick={() => setOpen(false)}
                className="absolute right-[-40px] top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow"
                aria-label="Menü schließen"
              >
                <X className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
