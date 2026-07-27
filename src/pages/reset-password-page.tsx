import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import capaImage from "@/assets/Capa.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, api } from "@/lib/api";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Link inválido ou expirado. Solicite uma nova redefinição de senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { newPassword: password, token });
      toast.success("Senha redefinida com sucesso. Faça login com a nova senha.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha. O link pode ter expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block lg:w-1/2">
        <img src={capaImage} alt="Fluxy Desk" className="h-full w-full object-cover" />
      </div>

      <div className="bg-dot-grid flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>Escolha uma nova senha para acessar sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <p className="text-destructive text-sm">
                Link inválido ou expirado.{" "}
                <Link to="/forgot-password" className="text-primary font-medium hover:underline">
                  Solicite um novo
                </Link>
                .
              </p>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <PasswordInput
                    id="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span className="text-muted-foreground text-xs">Mínimo de 8 caracteres.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <PasswordInput
                    id="confirm-password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" disabled={loading} className="mt-2">
                  {loading ? "Redefinindo..." : "Redefinir senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
