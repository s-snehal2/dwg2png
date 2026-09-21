"use client";

import { Download, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string | null;
  alt: string;
  title: string;
  subtitle: string;
  onDownload: () => void;
  downloadLabel?: string;
}

export default function ImageLightbox({
  open,
  onOpenChange,
  src,
  alt,
  title,
  subtitle,
  onDownload,
  downloadLabel = "Download image",
}: ImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] gap-0 overflow-hidden border-border/60 bg-black/95 p-0 text-white sm:max-w-[70vw]">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <p className="truncate text-xs text-white/60">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex max-h-[72vh] items-center justify-center overflow-auto bg-black p-2">
          {src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={alt}
              className="max-h-[62vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Download className="size-4" />
            {downloadLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
