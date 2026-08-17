import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { ChatPage } from "@/pages/ChatPage";
import { CasesPage } from "@/pages/CasesPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { RiskRadarPage } from "@/pages/RiskRadarPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { SettingsPage } from "@/pages/SettingsPage";

const queryClient = new QueryClient();

function Gate({ children }: { children: React.ReactNode }) {
  const { configured, loading, user } = useAuth();
  if (configured && loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-sand text-sm text-ink-subtle">
        Lädt…
      </div>
    );
  }
  if (configured && !user) return <LoginPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Gate>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/cases" element={<CasesPage />} />
                <Route path="/prompts" element={<PromptsPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/risk-radar" element={<RiskRadarPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </Gate>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
