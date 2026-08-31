import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useBootstrapSession } from "@/hooks/use-bootstrap-session";
import { RealtimeProvider } from "@/lib/realtime";
import { ActiveDispatchPage } from "@/pages/active-dispatch-page";
import { DeskLayout } from "@/pages/desk-layout";
import { EmptyTicketPage } from "@/pages/empty-ticket-page";
import { ForgotPasswordPage } from "@/pages/forgot-password-page";
import { LoginPage } from "@/pages/login-page";
import { ResetPasswordPage } from "@/pages/reset-password-page";
import { TicketChatPage } from "@/pages/ticket-chat-page";
import { TicketHistoryPage } from "@/pages/ticket-history-page";
import { RedirectIfAuthenticated, RequireAuth } from "@/routes/require-auth";

export function App() {
  const { ready } = useBootstrapSession();

  if (!ready) {
    return <div className="bg-dot-grid min-h-screen" />;
  }

  return (
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
        {/* RealtimeProvider só monta DEPOIS que RequireAuth confirma o login —
            antes ele ficava acima de /login e conectava o WebSocket 1x só,
            no boot do app. Se nesse momento authStorage ainda não tinha token
            (usuário caiu direto no /login), a conexão desistia em silêncio e
            nunca era refeita: o app inteiro ficava sem tempo real até um
            refresh manual remontar tudo do zero com o token já salvo. Montar
            aqui garante que o provider só nasce com o token já presente,
            tanto no primeiro login quanto ao trocar de usuário. */}
        <Route element={<RealtimeProvider><Outlet /></RealtimeProvider>}>
          <Route element={<DeskLayout />}>
            <Route path="/" element={<EmptyTicketPage />} />
            <Route path="/tickets/:id" element={<TicketChatPage />} />
            <Route path="/dispatch/new" element={<ActiveDispatchPage />} />
            <Route path="/history" element={<TicketHistoryPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
