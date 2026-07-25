import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { authStorage } from "@/lib/auth-storage";
import { useAppDispatch } from "@/store/hooks";
import { setSession } from "@/store/slices/auth-slice";

interface LoginResult {
  token?: string;
  user?: { id: string; name: string; email: string };
  companyId?: string;
  needsCompanySelection?: boolean;
  companies?: { id: string; name: string }[];
}

interface MeResult {
  user: { id: string; name: string; email: string };
  companyId: string;
  queueIds: string[];
}

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishLogin(token: string) {
    authStorage.setToken(token);
    const me = await api.get<MeResult>("/me");
    authStorage.setUser(me.user);
    authStorage.setCompanyId(me.companyId);
    dispatch(setSession({ user: me.user, companyId: me.companyId, queueIds: me.queueIds }));
    navigate("/", { replace: true });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<LoginResult>("/auth/login", { email, password });
      if (result.needsCompanySelection) {
        setCompanies(result.companies ?? []);
        return;
      }
      if (result.token) await finishLogin(result.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickCompany(companyId: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<LoginResult>("/auth/login", { email, password, companyId });
      if (result.token) await finishLogin(result.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
      toast.error("Não foi possível acessar esta empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-dot-grid flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Desk Console</CardTitle>
          <CardDescription>Atendimento humano em tempo real.</CardDescription>
        </CardHeader>
        <CardContent>
          {companies ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm">Selecione a empresa:</p>
              {companies.map((c) => (
                <Button key={c.id} variant="outline" disabled={loading} onClick={() => handlePickCompany(c.id)}>
                  {c.name}
                </Button>
              ))}
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
