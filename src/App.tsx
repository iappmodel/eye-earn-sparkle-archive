import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { UICustomizationProvider } from "@/contexts/UICustomizationContext";
import { DragContextProvider } from "@/components/DraggableButton";
import ProtectedRoute from "@/components/ProtectedRoute";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { BreadcrumbNavigation } from "@/components/BreadcrumbNavigation";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Install from "./pages/Install";
import Create from "./pages/Create";
import Studio from "./pages/Studio";
import MyPage from "./pages/MyPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isSwipingBack, swipeProgress } = useSwipeBack({
    enabled: true,
    threshold: 150,
    edgeWidth: 25,
  });

  return (
    <>
      <SwipeBackIndicator isActive={isSwipingBack} progress={swipeProgress} />
      <BreadcrumbNavigation />
      <OfflineBanner />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <Create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <Studio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-page"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />
        <Route path="/install" element={<Install />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocalizationProvider>
      <AccessibilityProvider>
        <UICustomizationProvider>
          <DragContextProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AuthProvider>
                  <OfflineProvider>
                    <AppContent />
                  </OfflineProvider>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </DragContextProvider>
        </UICustomizationProvider>
      </AccessibilityProvider>
    </LocalizationProvider>
  </QueryClientProvider>
);

export default App;
