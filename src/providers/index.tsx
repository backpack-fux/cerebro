"use client";

import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </NextThemesProvider>
  );
}
  