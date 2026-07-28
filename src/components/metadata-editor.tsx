import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface MetadataEditorProps {
  targetId: string;
  metadata: Record<string, unknown> | null;
  onUpdated: () => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// object E array (ex: "recomendacoes": [{...}, {...}]) precisam da mesma
// renderização recursiva em accordion — só string/number/etc. são "folha".
function isExpandable(value: unknown): boolean {
  return isPlainObject(value) || Array.isArray(value);
}

/// Uma linha key:value — se o valor for expansível (object/array) vira um
/// AccordionItem com a lista recursiva dentro; senão o valor vai num Badge.
function MetadataEntry({ label, value }: { label: string; value: unknown }) {
  if (isExpandable(value)) {
    return (
      <AccordionItem title={label}>
        <MetadataValue value={value} />
      </AccordionItem>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="default" className="h-8 shrink-0">
        {label}
      </Badge>
      <Badge
        variant="outline"
        className="h-8 min-w-0 max-w-full justify-start truncate border-neutral-200 bg-white text-neutral-900"
      >
        {String(value)}
      </Badge>
    </div>
  );
}

/// Conteúdo de dentro de um accordion: object vira lista de key:value pelas
/// próprias keys; array vira lista de key:value indexada (#0, #1, ...). Cada
/// item que também for expansível volta a virar accordion (recursivo).
function MetadataValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground text-xs italic">lista vazia</span>;
    return (
      <div className="flex flex-col gap-1.5">
        {value.map((item, index) => (
          <MetadataEntry key={index} label={`#${index}`} value={item} />
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-muted-foreground text-xs italic">vazio</span>;
    return (
      <div className="flex flex-col gap-1.5">
        {entries.map(([key, nested]) => (
          <MetadataEntry key={key} label={key} value={nested} />
        ))}
      </div>
    );
  }

  return (
    <Badge variant="outline" className="h-8 max-w-full truncate border-neutral-200 bg-white text-neutral-900">
      {String(value)}
    </Badge>
  );
}

/// "Atualizar dados do contato, adicionar novos dados no metadado usando
/// key:value" — input de chave + input de valor, exatamente como o escopo pede.
export function MetadataEditor({ targetId, metadata, onUpdated }: MetadataEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const entries = Object.entries(metadata ?? {});

  async function save(next: Record<string, unknown>) {
    setSaving(true);
    try {
      await api.patch(`/targets/${targetId}`, { metadata: next });
      onUpdated();
    } catch {
      toast.error("Não foi possível salvar o metadado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!newKey.trim()) return;
    await save({ [newKey.trim()]: newValue });
    setNewKey("");
    setNewValue("");
  }

  async function handleRemove(key: string) {
    // null é o sinal que o backend interpreta como "remover esta chave" do
    // merge raso (ver updateTargetContact em Desk-API/ticket-service.ts).
    await save({ [key]: null });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Metadados do contato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <MetadataEntry label={key} value={value} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 size-6 shrink-0"
              disabled={saving}
              onClick={() => handleRemove(key)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        <div className="mt-2 flex items-center gap-2">
          <Input placeholder="Chave" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Valor" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="h-8 text-xs" />
          <Button
            size="icon"
            aria-label="Adicionar metadado"
            className="size-8 shrink-0"
            disabled={saving || !newKey.trim()}
            onClick={handleAdd}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
