"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          borderRadius: "2px",
          border: "1px solid rgba(27,35,85,0.1)",
          fontFamily: "var(--font-sans)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
