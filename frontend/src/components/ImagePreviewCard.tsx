"use client";

import { Download, Expand } from "lucide-react";
import { cn } from "cn";

interface ImagePreviewCardProps {
  src: string;
  alt: string;
  imageClassName?: string;
  onToggleBig: () => void;
  onDownload: () => void;
}

export default function ImagePreviewCard({
  src,
  alt,
  imageClassName,
  onToggleBig,
  onDownload,
}: ImagePreviewCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
      <button
        type="button"
        onClick={onToggleBig}
        aria-label={`View ${alt} larger`}
        className="block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "block max-h-[38vh] w-full bg-white object-contain transition-transform duration-300 group-hover:scale-[1.015]",
            imageClassName
          )}
        />
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/0 transition group-hover:ring-foreground/10" />
      </button>

      <div className="absolute right-2.5 bottom-2.5 flex gap-1.5">
        <button
          type="button"
          onClick={onToggleBig}
          aria-label="View larger"
          className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Expand className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDownload}
          aria-label="Download"
          className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Download className="size-4" />
        </button>
      </div>
    </div>
  );
}
