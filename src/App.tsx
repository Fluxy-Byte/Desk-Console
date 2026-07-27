import { Navigate, Route, Routes } from "react-router-dom";
import { useBootstrapSession } from "@/hooks/use-bootstrap-session";
import { RealtimeProvider } from "@/lib/realtime";
import { DeskLayout } from "@/pages/desk-layout";
import { EmptyTicketPage } from "@/pages/empty-ticket-page";
import { ForgotPasswordPage } from "@/pages/forgot-password-page";
import { LoginPage } from "@/pages/login-page";
import { ResetPasswordPage } from "@/pages/reset-password-page";
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
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthenticated>
              <ForgotPasswordPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<DeskLayout />}>
            <Route path="/" element={<EmptyTicketPage />} />
            <Route path="/tickets/:id" element={<TicketChatPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RealtimeProvider>
  );
}
