import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Target } from "@/types/domain";

interface ContactInfoCardProps {
  target: Target;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

export function ContactInfoCard({ target }: ContactInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Contato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <InfoRow label="Nome" value={target.name || "Sem nome"} />
        <InfoRow label="Número" value={target.waId} />
        <InfoRow label="E-mail" value={target.email || "Não informado"} />
      </CardContent>
    </Card>
  );
}
