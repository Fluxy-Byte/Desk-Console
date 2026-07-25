import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

export function RequireAuth() {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);

  if (status !== "ready") return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const user = useAppSelector((s) => s.auth.user);

  if (status !== "ready") return null;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}
