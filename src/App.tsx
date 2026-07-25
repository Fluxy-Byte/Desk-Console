import { Navigate, Route, Routes } from "react-router-dom";
import { useBootstrapSession } from "@/hooks/use-bootstrap-session";
import { RealtimeProvider } from "@/lib/realtime";
import { LoginPage } from "@/pages/login-page";
import { QueueBoardPage } from "@/pages/queue-board-page";
import { TicketChatPage } from "@/pages/ticket-chat-page";
import { RedirectIfAuthenticated, RequireAuth } from "@/routes/require-auth";

export function App() {
  const { ready } = useBootstrapSession();

  if (!ready) {
    return <div className="bg-dot-grid min-h-screen" />;
  }

  return (
    <RealtimeProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<QueueBoardPage />} />
          <Route path="/tickets/:id" element={<TicketChatPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RealtimeProvider>
  );
}
