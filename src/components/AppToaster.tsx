"use client";

import { Toaster } from "sonner";

export default function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      toastOptions={{
        style: {
          background: "#18181b",
          border: "1px solid #3f3f46",
          color: "#fff",
        },
      }}
    />
  );
}
