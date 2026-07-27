import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

interface AccordionItemProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/// details/summary nativo — cobre toggle + acessibilidade sem precisar de
/// mais uma dependência radix só pra isso.
export function AccordionItem({ title, defaultOpen, className, children }: AccordionItemProps) {
  return (
    <details className={cn("group border-border bg-card rounded-lg border", className)} open={defaultOpen}>
      <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border border-t px-3 py-2">{children}</div>
    </details>
  );
}
