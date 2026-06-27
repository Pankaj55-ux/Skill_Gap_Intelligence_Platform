import { type PropsWithChildren } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./AuthProvider";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4_000 }} />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
