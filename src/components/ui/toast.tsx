"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/format";

export interface Toast {
  id: number;
  tone: "ok" | "error";
  message: string;
}

let nextId = 1;

/**
 * Minimal toast queue. Messages live in provider state rather than a global
 * store so they disappear when the page that raised them unmounts.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (tone: Toast["tone"], message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, tone, message }]);
    return id;
  };

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: readonly Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = toast.tone === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex animate-fade-rise items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift",
        toast.tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toast.tone === "ok" ? "text-emerald-600" : "text-rose-600")} />
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        aria-label="ปิดการแจ้งเตือน"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
