import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface MetadataEditorProps {
  targetId: string;
  metadata: Record<string, unknown> | null;
  onUpdated: () => void;
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
    // Merge no backend só soma/sobrescreve — remoção precisa mandar undefined
    // explicitamente não é suportado pelo merge raso, então marcamos como
    // string vazia (o mais próximo de "removido" sem mudar o contrato do
    // backend). Documentado aqui por ser uma limitação conhecida.
    await save({ [key]: "" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Metadados do contato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="bg-muted rounded px-2 py-1 text-xs font-medium">{key}</span>
            <span className="text-muted-foreground flex-1 truncate text-xs">{String(value)}</span>
            <Button variant="ghost" size="icon" className="size-6" disabled={saving} onClick={() => handleRemove(key)}>
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
