// Main App Component - v3
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();
const IndexPage = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/Auth").then((module) => ({ default: module.Auth })));
const NotFoundPage = lazy(() => import("./pages/NotFound"));

function AppFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppContent() {
  const auth = useAuthContext();

  if (auth.isLoading) {
    return <AppFallback />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<AppFallback />}>
        <Routes>
          <Route path="/" element={auth.isAuthenticated ? <IndexPage /> : <AuthPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <AppearanceProvider>
              <Toaster />
              <Sonner />
              <AppContent />
            </AppearanceProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
