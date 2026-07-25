import { useEffect } from "react";
import { ApiError, api } from "../lib/api";
import { authStorage } from "../lib/auth-storage";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearSession, setSession } from "../store/slices/auth-slice";

interface MeResult {
  user: { id: string; name: string; email: string };
  companyId: string;
  queueIds: string[];
}

/// Ao carregar o app, valida o token guardado em sessionStorage contra
/// GET /me — nunca confia cegamente no que está salvo (pode ter expirado).
export function useBootstrapSession() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);

  useEffect(() => {
    async function run() {
      const token = authStorage.getToken();
      if (!token) {
        dispatch(clearSession());
        return;
      }

      try {
        const me = await api.get<MeResult>("/me");
        dispatch(setSession({ user: me.user, companyId: me.companyId, queueIds: me.queueIds }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          authStorage.clear();
        }
        dispatch(clearSession());
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ready: status === "ready" };
}
