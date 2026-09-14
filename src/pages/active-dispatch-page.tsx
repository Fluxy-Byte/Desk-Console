import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import fundoWhatsApp from "@/assets/FundoWhatsApp.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Queue, Target, Template } from "@/types/domain";

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

/// Sem `values`: mostra o placeholder "[Variável N]". Com `values`: substitui
/// pelo valor já digitado no formulário, pra dar pra ver como a mensagem fica
/// de verdade (aqui é sempre 1 contato, então sempre dá pra pré-visualizar).
function highlightVariables(text: string | undefined, values?: string[]): string {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (match, n: string) => {
    const value = values?.[Number(n) - 1];
    return value ? value : `[Variável ${n}]`;
  });
}

/// Trecho entre *asteriscos simples* (formatação de negrito do WhatsApp) vira
/// <strong> de verdade na pré-visualização, em vez de mostrar os asteriscos.
function renderBold(text: string): ReactNode {
  return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/// Igual à tela "Nova campanha" do Agent Console (template + preview +
/// variáveis), trocando Agente+Canal por Fila (dela resolvemos o canal) e sem
/// modo CSV — aqui é sempre 1 contato por disparo.
export function ActiveDispatchPage() {
  const navigate = useNavigate();

  const { data: queues } = useSWR<Queue[]>("/queues");
  const dispatchQueues = queues?.filter((q) => q.serviceIsland?.allowActiveDispatch) ?? [];

  const [queueId, setQueueId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [variables, setVariables] = useState<string[]>([]);

  const selectedQueue = dispatchQueues.find((q) => q.id === queueId);
  const whatsappChannelId = selectedQueue?.serviceIsland?.whatsappChannelId;

  const { data: templates, error: templatesError } = useSWR<Template[]>(
    whatsappChannelId ? `/whatsapp-channels/${whatsappChannelId}/templates` : null,
  );

  const selectedTemplate = templates?.find((t) => t.name === templateName) ?? null;
  const headerCount = selectedTemplate?.variableCount.header ?? 0;
  const bodyCount = selectedTemplate?.variableCount.body ?? 0;
  const totalVars = headerCount + bodyCount;

  const headerComponent = selectedTemplate?.components.find((c) => c.type === "HEADER");
  const bodyComponent = selectedTemplate?.components.find((c) => c.type === "BODY");
  const footerComponent = selectedTemplate?.components.find((c) => c.type === "FOOTER");
  const buttonsComponent = selectedTemplate?.components.find((c) => c.type === "BUTTONS");

  useEffect(() => {
    setTemplateName("");
  }, [queueId]);

  // Trocar de template muda a quantidade de variáveis esperadas.
  useEffect(() => {
    setVariables(Array.from({ length: totalVars }, () => ""));
  }, [templateName, totalVars]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: results } = useSWR<Target[]>(
    whatsappChannelId && contactMode === "existing" && debouncedSearch.length >= 2
      ? `/targets/search?whatsappChannelId=${whatsappChannelId}&q=${encodeURIComponent(debouncedSearch)}`
      : null,
  );

  const newPhoneDigits = newPhone.replace(/\D/g, "");
  const newErrors: string[] = [];
  if (contactMode === "new" && newPhone && newPhoneDigits.length < 8) newErrors.push("Telefone inválido");
  if (contactMode === "new" && newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) newErrors.push("Email inválido");
  const missingVariable = variables.slice(0, totalVars).some((v) => !v);

  const hasContact = contactMode === "existing" ? Boolean(selectedTarget) : newPhoneDigits.length >= 8;

  const canSubmit = Boolean(
    queueId && selectedTemplate && hasContact && !submitting && newErrors.length === 0 && !missingVariable,
  );

  async function handleSubmit() {
    if (!selectedTemplate) return;
    setError(null);
    setSubmitting(true);

    const contact =
      contactMode === "existing" && selectedTarget
        ? { phone: selectedTarget.waId, name: selectedTarget.name ?? undefined, email: selectedTarget.email ?? undefined }
        : { phone: newPhoneDigits, name: newName.trim() || undefined, email: newEmail.trim() || undefined };

    try {
      await api.post("/dispatch", {
        queueId,
        templateName: selectedTemplate.name,
        templateHeaderText: headerComponent?.text,
        templateBodyText: bodyComponent?.text,
        contact: {
          ...contact,
          parametersHeader:
            headerCount > 0 ? variables.slice(0, headerCount).map((v) => ({ type: "text", text: v })) : undefined,
          parametersBody:
            bodyCount > 0
              ? variables.slice(headerCount, headerCount + bodyCount).map((v) => ({ type: "text", text: v }))
              : undefined,
        },
      });
      toast.success("Disparo enviado — o ticket vai aparecer em Meus tickets.");
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível disparar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="w-fit gap-2 px-2">
        <ArrowLeft className="size-4" /> Voltar
      </Button>

      <div className="border-border bg-card rounded-lg border p-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Novo disparo ativo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Envia um template de WhatsApp pra um contato — o ticket volta pra você, na fila escolhida.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fila</CardTitle>
          <CardDescription>Clique numa fila para escolher onde este disparo será registrado.</CardDescription>
        </CardHeader>
        <CardContent>
          {dispatchQueues.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nenhuma fila sua tem disparo ativo habilitado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dispatchQueues.map((q) => (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => setQueueId(q.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border px-4 py-2 text-left font-medium transition-colors",
                    queueId === q.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                  )}
                >
                  {q.name}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {queueId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template</CardTitle>
            <CardDescription>Escolha o template aprovado pela Meta que será enviado neste disparo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {templatesError ? (
              <p className="text-destructive text-sm">Não foi possível listar os templates deste canal.</p>
            ) : templates === undefined ? (
              <p className="text-muted-foreground text-sm">Carregando templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum template encontrado para este canal.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTemplateName(t.name)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      templateName === t.name ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="outline">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">{t.language}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização</CardTitle>
            <CardDescription>Confira como a mensagem vai chegar pro cliente e preencha as variáveis do template.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <div
              className="flex flex-1 items-start justify-center rounded-lg bg-[#e5ddd5] bg-repeat bg-[length:320px] p-6 [background-image:var(--wa-bg)]"
              style={{ "--wa-bg": `url(${fundoWhatsApp})` } as React.CSSProperties}
            >
              <div className="relative flex max-w-sm flex-col gap-1 rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 text-sm text-black shadow-md dark:bg-[#005c4b] dark:text-white">
                <div className="absolute top-0 right-0 size-0 translate-x-full border-t-8 border-r-8 border-t-[#d9fdd3] border-r-transparent dark:border-t-[#005c4b]" />
                {headerComponent?.text && (
                  <p className="font-semibold">
                    {renderBold(highlightVariables(headerComponent.text, headerCount > 0 ? variables.slice(0, headerCount) : undefined))}
                  </p>
                )}
                {bodyComponent?.text && (
                  <p className="whitespace-pre-wrap">
                    {renderBold(
                      highlightVariables(bodyComponent.text, bodyCount > 0 ? variables.slice(headerCount, headerCount + bodyCount) : undefined),
                    )}
                  </p>
                )}
                {footerComponent?.text && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{renderBold(footerComponent.text)}</p>
                )}
                <p className="text-right text-[10px] text-gray-500 dark:text-gray-400">
                  {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1 border-t border-gray-200 pt-1 dark:border-gray-600">
                    {buttonsComponent.buttons.map((b, i) => (
                      <span key={i} className="text-center text-sm text-blue-600 dark:text-blue-400">
                        {b.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 text-sm">
              <div>
                <Badge variant="outline" className="border-transparent bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {totalVars} variável{totalVars === 1 ? "" : "eis"} necessária{totalVars === 1 ? "" : "s"}
                </Badge>
                {totalVars > 0 && (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Preencha cada variável na ordem em que ela aparece na mensagem ao lado.
                  </p>
                )}
              </div>

              {totalVars > 0 && (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: totalVars }).map((_, i) => (
                    <div key={i} className="border-border rounded-lg border p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {i + 1}
                        </span>
                        <Label htmlFor={`dispatch-var-${i}`} className="text-xs font-normal">
                          {i < headerCount ? "Header" : "Corpo"} · variável {i + 1}
                        </Label>
                      </div>
                      <Input
                        id={`dispatch-var-${i}`}
                        value={variables[i] ?? ""}
                        onChange={(e) =>
                          setVariables((prev) => {
                            const next = [...prev];
                            next[i] = e.target.value;
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contato</CardTitle>
            <CardDescription>Escolha um contato já cadastrado ou informe um número novo para receber o disparo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setContactMode("existing")}
                className={cn(
                  "flex h-8 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors",
                  contactMode === "existing" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                Contato existente
              </button>
              <button
                type="button"
                onClick={() => setContactMode("new")}
                className={cn(
                  "flex h-8 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors",
                  contactMode === "new" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                Novo número
              </button>
            </div>

            {contactMode === "existing" ? (
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Buscar por nome ou telefone…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedTarget(null);
                  }}
                />
                {selectedTarget ? (
                  <div className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{selectedTarget.name || selectedTarget.waId}</span>
                    <button
                      type="button"
                      className="text-muted-foreground text-xs underline"
                      onClick={() => setSelectedTarget(null)}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {results?.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTarget(t)}
                        className="hover:bg-accent rounded-md border px-3 py-2 text-left text-sm"
                      >
                        <p className="font-medium">{t.name || t.waId}</p>
                        {t.name && <p className="text-muted-foreground text-xs">{t.waId}</p>}
                      </button>
                    ))}
                    {debouncedSearch.length >= 2 && results && results.length === 0 && (
                      <p className="text-muted-foreground text-xs">Nenhum contato encontrado sem ticket aberto.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dispatch-phone">Telefone</Label>
                  <PhoneInput id="dispatch-phone" value={newPhone} onChange={setNewPhone} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dispatch-name">Nome (opcional)</Label>
                  <Input id="dispatch-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dispatch-email">Email (opcional)</Label>
                  <Input id="dispatch-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
                {newErrors.length > 0 && <p className="text-destructive text-xs sm:col-span-3">{newErrors.join(", ")}</p>}
              </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="w-fit gap-2">
              <Send className="size-4" />
              {submitting ? "Disparando…" : "Disparar"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
