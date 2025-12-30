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
import { GlobalNetworkStatus } from "@/components/layout/GlobalNetworkStatus";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { BreadcrumbNavigation } from "@/components/BreadcrumbNavigation";
import { PageTransition } from "@/components/layout/PageTransition";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Install from "./pages/Install";
import Create from "./pages/Create";
import Studio from "./pages/Studio";
import MyPage from "./pages/MyPage";
import Search from "./pages/Search";
import Hashtag from "./pages/Hashtag";
import UserProfile from "./pages/UserProfile";
import VideoDetail from "./pages/VideoDetail";
import NotFound from "./pages/NotFound";
import SocialConnect from "./pages/SocialConnect";
import { PromotionDetails } from "./components/PromotionDetails";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isSwipingBack, swipeProgress } = useSwipeBack({
    enabled: true,
    threshold: 150,
    edgeWidth: 25,
  });

  return (
    <>
      <GlobalNetworkStatus />
      <SwipeBackIndicator isActive={isSwipingBack} progress={swipeProgress} />
      <BreadcrumbNavigation />
      <OfflineBanner />
      <PageTransition>
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
        <Route
          path="/social-connect"
          element={
            <ProtectedRoute>
              <SocialConnect />
            </ProtectedRoute>
          }
        />
        <Route path="/install" element={<Install />} />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tag/:tag"
          element={
            <ProtectedRoute>
              <Hashtag />
            </ProtectedRoute>
          }
        />
        <Route
          path="/u/:userId"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/v/:videoId"
          element={
            <ProtectedRoute>
              <VideoDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/promotion/:id"
          element={
            <ProtectedRoute>
              <PromotionDetails />
            </ProtectedRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </PageTransition>
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
