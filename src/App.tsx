import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Providers from "./pages/Providers";
import Models from "./pages/Models";
import ApiKeys from "./pages/ApiKeys";
import ApiKeyForm from "./pages/ApiKeyForm";
import Logs from "./pages/Logs";
import ProfileSettings from "./pages/ProfileSettings";
import Documentation from "./pages/Documentation";
import Playground from "./pages/Playground";
import MediaManager from "./pages/MediaManager";
import RemoveBgTest from "./pages/RemoveBgTest";
import GiphyTest from "./pages/GiphyTest";
import HuggingFaceTest from "./pages/HuggingFaceTest";
import NotFound from "./pages/NotFound";

// Active client query instance
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="providers" element={<Providers />} />
              <Route path="models" element={<Models />} />
              <Route path="api-keys" element={<ApiKeys />} />
              <Route path="api-keys/create" element={<ApiKeyForm />} />
              <Route path="api-keys/edit/:id" element={<ApiKeyForm />} />
              <Route path="playground" element={<Playground />} />
              <Route path="media" element={<MediaManager />} />
              <Route path="removebg" element={<RemoveBgTest />} />
              <Route path="giphy" element={<GiphyTest />} />
              <Route path="huggingface" element={<HuggingFaceTest />} />
              <Route path="logs" element={<Logs />} />
              <Route path="settings" element={<ProfileSettings />} />
              <Route path="docs" element={<Documentation />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
