import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Queue, Target, Template } from "@/types/domain";

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
};

function highlightVariables(text: string | undefined): string {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, "[Variável $1]");
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
          <CardTitle className="text-base">1. Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label>Fila</Label>
            <Select value={queueId} onValueChange={setQueueId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma fila" />
              </SelectTrigger>
              <SelectContent>
                {dispatchQueues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dispatchQueues.length === 0 && (
              <p className="text-muted-foreground text-xs">Nenhuma fila sua tem disparo ativo habilitado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {queueId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Template</CardTitle>
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
            <CardTitle className="text-base">3. Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 items-start justify-center rounded-lg bg-[#e5ddd5] p-6 dark:bg-[#0b141a]">
              <div className="flex max-w-sm flex-col gap-1 rounded-lg bg-white p-3 text-sm text-black shadow-md dark:bg-[#202c33] dark:text-white">
                {headerComponent?.text && <p className="font-semibold">{highlightVariables(headerComponent.text)}</p>}
                {bodyComponent?.text && <p className="whitespace-pre-wrap">{highlightVariables(bodyComponent.text)}</p>}
                {footerComponent?.text && <p className="text-xs text-gray-500 dark:text-gray-400">{footerComponent.text}</p>}
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
            <div className="flex flex-1 flex-col gap-2 text-sm">
              <p>
                <strong>{totalVars}</strong> variável{totalVars === 1 ? "" : "eis"} necessária{totalVars === 1 ? "" : "s"}
              </p>
              {headerCount > 0 && <p className="text-muted-foreground">Header: {headerCount} variável(is)</p>}
              {bodyCount > 0 && <p className="text-muted-foreground">Corpo: {bodyCount} variável(is)</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Contato</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setContactMode("existing")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  contactMode === "existing" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                )}
              >
                Contato existente
              </button>
              <button
                type="button"
                onClick={() => setContactMode("new")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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
                  <Input
                    id="dispatch-phone"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="5511999999999"
                  />
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

            {totalVars > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: totalVars }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Label htmlFor={`dispatch-var-${i}`}>
                      Variável {i + 1} {i < headerCount ? "(header)" : "(corpo)"}
                    </Label>
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
