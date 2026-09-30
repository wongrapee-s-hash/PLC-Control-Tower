"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/format";

/**
 * Accessible dialog: focus is moved in on open, Escape and backdrop clicks
 * close it, and Tab is trapped inside so a keyboard operator cannot tab into
 * the page behind a modal.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-steel-950/45 p-4 backdrop-blur-sm sm:p-8">
      <button
        type="button"
        aria-label="ปิดหน้าต่าง"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "panel animate-fade-rise relative w-full",
          width === "lg" ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <header className="panel-header">
          <div>
            <h2 className="panel-title text-base">{title}</h2>
            {description ? <p className="panel-subtitle mt-0.5">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1.5" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5 scrollbar-slim">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-steel-200 px-5 py-4 dark:border-white/10">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
