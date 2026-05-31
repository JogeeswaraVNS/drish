import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import Dashboard from "./pages/Dashboard";
import CreateCarousel from "./pages/CreateCarousel";
import GenerationView from "./pages/GenerationView";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import WorkspaceView from "./pages/WorkspaceView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pending" element={<PendingApproval />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateCarousel /></ProtectedRoute>} />
            <Route path="/workspace/:id" element={<ProtectedRoute><WorkspaceView /></ProtectedRoute>} />
            <Route path="/generation/:id" element={<ProtectedRoute><GenerationView /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
