"use client";

import { ValidationProvider } from "@/contexts/validation-context";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ValidationProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </NextThemesProvider>
    </ValidationProvider>
  );
}
  