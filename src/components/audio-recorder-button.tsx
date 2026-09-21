import { useEffect, useRef, useState } from "react";
import { Check, Mic, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/// Melhor formato que o navegador sabe gravar. OGG/Opus (Firefox) a Meta aceita
/// direto; WebM/Opus (Chrome/Edge) e MP4 (Safari, e Chrome recente — com Opus,
/// que a Meta rejeita) o Outbound-Worker converte pra OGG/Opus com ffmpeg
/// antes de enviar (ver prepare-audio.ts). MP4 fica por último: só entra quando
/// o navegador não sabe gravar nenhum dos outros.
const PREFERRED_MIME_TYPES = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/// Teto de segurança — o limite da Meta pra áudio é 16MB, bem acima disso pra
/// voz, mas gravação esquecida aberta não deve crescer sem fim.
const MAX_RECORDING_SECONDS = 5 * 60;

function pickMimeType(): string | undefined {
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface AudioRecorderButtonProps {
  disabled?: boolean;
  /// Chamado ao concluir a gravação — mimeType já sem os parâmetros de codec
  /// ("audio/webm", não "audio/webm;codecs=opus").
  onRecorded: (blob: Blob, mimeType: string) => void | Promise<void>;
}

/// Botão de microfone do compositor: clica pra gravar, confirma (✓) pra enviar
/// ou cancela (✗) pra descartar.
export function AudioRecorderButton({ disabled, onRecorded }: AudioRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);

  function releaseResources() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  // Sai da tela no meio da gravação → descarta e solta o microfone.
  useEffect(() => {
    return () => {
      discardRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Este navegador não suporta gravação de áudio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    discardRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const discard = discardRef.current;
      const recordedType = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type: recordedType });
      releaseResources();
      if (!discard && blob.size > 0) void onRecorded(blob, recordedType);
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setSeconds(0);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS) finish(false);
    }, 500);
  }

  function finish(discard: boolean) {
    discardRef.current = discard;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  if (!recording) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12 shrink-0"
        disabled={disabled}
        onClick={() => void start()}
        aria-label="Gravar áudio"
      >
        <Mic className="size-4" />
      </Button>
    );
  }

  return (
    <div className="border-destructive/40 bg-destructive/5 flex h-12 shrink-0 items-center gap-2 rounded-md border px-2">
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => finish(true)} aria-label="Cancelar gravação">
        <X className="size-4" />
      </Button>
      <span className="bg-destructive size-2 animate-pulse rounded-full" />
      <span className="text-destructive w-10 text-sm tabular-nums">{formatTimer(seconds)}</span>
      <Button type="button" size="icon" className="size-8" onClick={() => finish(false)} aria-label="Enviar áudio">
        <Check className="size-4" />
      </Button>
    </div>
  );
}
