import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DdiOption {
  code: string;
  flag: string;
  country: string;
  /// Quantos dígitos o número local (sem DDI) tem no máximo — trava o input
  /// pra não deixar digitar além do formato do país.
  maxLocalDigits: number;
  /// Formata os dígitos locais já digitados (parcial ou completo) pro
  /// padrão visual do país, ex: "(34) 9 9780-1829".
  format: (localDigits: string) => string;
}

/// Celular brasileiro: DDD(2) + "9"(1) + assinante(8) = 11 dígitos locais.
/// Sempre no formato com o 9 isolado — é assim que a Meta identifica o
/// contato (mesma regra do Agent Console/Agent-Api), então o input já força
/// esse formato em vez de deixar ambíguo se o 9 foi digitado ou não.
function formatBrazil(digits: string): string {
  const ddd = digits.slice(0, 2);
  const nine = digits.slice(2, 3);
  const part1 = digits.slice(3, 7);
  const part2 = digits.slice(7, 11);

  let out = "";
  if (ddd) out += `(${ddd}`;
  if (ddd.length === 2) out += ")";
  if (nine) out += ` ${nine}`;
  if (part1) out += ` ${part1}`;
  if (part2) out += `-${part2}`;
  return out;
}

/// Fallback genérico pra DDIs sem máscara própria — só agrupa em blocos de 4,
/// sem assumir DDD/formato de nenhum país específico.
function formatGeneric(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export const DDI_OPTIONS: DdiOption[] = [
  { code: "55", flag: "🇧🇷", country: "Brasil", maxLocalDigits: 11, format: formatBrazil },
  { code: "1", flag: "🇺🇸", country: "Estados Unidos", maxLocalDigits: 10, format: formatGeneric },
  { code: "351", flag: "🇵🇹", country: "Portugal", maxLocalDigits: 9, format: formatGeneric },
  { code: "54", flag: "🇦🇷", country: "Argentina", maxLocalDigits: 10, format: formatGeneric },
];

const DEFAULT_DDI = DDI_OPTIONS[0];

function resolveDdi(code: string): DdiOption {
  return DDI_OPTIONS.find((d) => d.code === code) ?? DEFAULT_DDI;
}

/// Separa um valor "cru" (só dígitos, com DDI na frente — o mesmo formato
/// que a API espera, ex: "5534997801829") em DDI reconhecido + resto local.
/// DDI mais longo primeiro (ex: "351" antes de "1") pra não casar errado.
function splitValue(value: string): { ddiCode: string; local: string } {
  const digits = value.replace(/\D/g, "");
  const sorted = [...DDI_OPTIONS].sort((a, b) => b.code.length - a.code.length);
  const match = sorted.find((d) => digits.startsWith(d.code));
  if (!match) return { ddiCode: DEFAULT_DDI.code, local: digits };
  return { ddiCode: match.code, local: digits.slice(match.code.length) };
}

interface PhoneInputProps {
  /// Dígitos crus com DDI incluído (ex: "5534997801829") — mesmo formato que
  /// o backend já espera em todo lugar que hoje recebe telefone como texto
  /// livre. Nunca formatado.
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/// Input de telefone com seletor de DDI — força o formato correto do país
/// escolhido (pro Brasil, sempre com o dígito 9 do celular isolado) em vez de
/// deixar o usuário digitar texto livre. Mesma regra usada no Agent Console
/// pro "Novo número" de campanha, pra não duplicar contato por causa do 9.
export function PhoneInput({ value, onChange, disabled, id, className }: PhoneInputProps) {
  const { ddiCode, local } = useMemo(() => splitValue(value), [value]);
  const ddi = resolveDdi(ddiCode);

  function handleDdiChange(nextCode: string) {
    onChange(`${nextCode}${local}`);
  }

  function handleLocalChange(rawInput: string) {
    const digits = rawInput.replace(/\D/g, "").slice(0, ddi.maxLocalDigits);
    onChange(`${ddi.code}${digits}`);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select value={ddi.code} onValueChange={handleDdiChange} disabled={disabled}>
        <SelectTrigger id={id ? `${id}-ddi` : undefined} className="w-[110px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              {ddi.flag} +{ddi.code}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DDI_OPTIONS.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.flag} +{option.code} · {option.country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={ddi.format("34997801829".slice(0, ddi.maxLocalDigits))}
        value={ddi.format(local)}
        onChange={(e) => handleLocalChange(e.target.value)}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
