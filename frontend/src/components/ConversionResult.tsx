"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { downloadUrl, generateAiImage, aiDownloadUrl, sendToTilesview } from "@/services/api";

import { Check, RotateCcw, Sparkles, Loader2, Download, MonitorSmartphone } from "lucide-react";
import type { ConversionResult as ConversionResultData } from "@/types/conversion";

import { Button } from "@/components/ui/button";
import ImagePreviewCard from "@/components/ImagePreviewCard";
import ImageLightbox from "@/components/ImageLightbox";


interface ConversionResultProps {
  result: ConversionResultData;
  onReset: () => void;
}

export default function ConversionResult({ result, onReset }: ConversionResultProps) {
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);
  const [lightbox, setLightbox] = useState<"png" | "ai" | null>(null);
  const [sendingToTilesview, setSendingToTilesview] = useState(false);
  const [tilesviewRoomId, setTilesviewRoomId] = useState<number | null>(null);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl(result.conversionId), { cache: "no-store" });
      if (!res.ok || !res.headers.get("content-type")?.includes("image/png")) {
        throw new Error("Your converted file is no longer available on this server.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The PNG could not be downloaded.";
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }, [downloading, result.conversionId, result.fileName]);

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setAiDone(false);
    try {
      const res = await generateAiImage(result.conversionId);
      setAiUsage({ used: res.generationsUsed, limit: res.generationsLimit });
      setAiDone(true);
      toast.success("AI image generated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generation failed.";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }, [generating, result.conversionId]);
  const handleTilesview = useCallback(async () => {
    if (sendingToTilesview) return;
    setSendingToTilesview(true);
    try {
      const res = await sendToTilesview(result.conversionId);
      setTilesviewRoomId(res.customRoomsId);
      toast.success(`Sent to TilesView. Room ID: ${res.customRoomsId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sending to TilesView failed.";
      toast.error(message);
    } finally {
      setSendingToTilesview(false);
    }
  }, [sendingToTilesview, result.conversionId]);

  const handleAiDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(aiDownloadUrl(result.conversionId), { cache: "no-store" });
      if (!res.ok || !res.headers.get("content-type")?.includes("image/png")) {
        throw new Error("The AI image is no longer available on this server.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.fileName.replace(/\.png$/i, "")}-ai.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The AI image could not be downloaded.";
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }, [downloading, result.conversionId, result.fileName]);

  const lightboxSrc =
    lightbox === "ai"
      ? aiDownloadUrl(result.conversionId)
      : lightbox === "png"
        ? downloadUrl(result.conversionId)
        : null;

  const warnings = Array.from(new Set(result.warnings ?? []));
  const skipped = result.statistics?.skippedEntities ?? 0;
  const warningsHeadline =
    skipped > 0
      ? `${skipped} unsupported ${skipped === 1 ? "entity was" : "entities were"} skipped.`
      : `${warnings.length} ${warnings.length === 1 ? "warning was" : "warnings were"} generated during conversion.`;

  return (
    <div className="mt-5 animate-slide-up space-y-4">
      <div className="relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25">
          <Check className="size-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Your PNG is ready</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {result.fileName}
            {result.size ? ` · ${(result.size / (1024 * 1024)).toFixed(2)} MB` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl space-y-1.5">
        <ImagePreviewCard
          src={downloadUrl(result.conversionId)}
          alt={`Converted PNG: ${result.fileName}`}
          onToggleBig={() => setLightbox("png")}
          onDownload={handleDownload}
        />
        <p className="truncate px-1 text-center text-xs font-medium text-muted-foreground">{result.fileName}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-11 flex-1 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-500 hover:to-violet-600 hover:shadow-indigo-500/40 disabled:from-indigo-500/60 disabled:to-violet-500/60"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
          {downloading ? "Downloading…" : "Download PNG"}
        </Button>
        <Button variant="outline" className="h-11 flex-1 rounded-xl text-sm sm:flex-none sm:px-6" onClick={onReset}>
          <RotateCcw />
          Convert another
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          <p className="font-medium">{warningsHeadline}</p>
          <details className="mt-1.5">
            <summary className="cursor-pointer list-none font-medium underline decoration-dotted underline-offset-4">
              Details ({warnings.length})
            </summary>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="border-t border-border/40 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            AI visualization
          </span>
          <span className="h-px flex-1 bg-border/60" />
        </div>

        <div className="space-y-2.5">
          <Button
            className="h-10 w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-500 text-sm font-semibold text-white shadow-md shadow-amber-500/25 transition-all hover:from-amber-500 hover:to-orange-600 hover:shadow-amber-500/35 disabled:from-amber-500/60 disabled:to-orange-500/60"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating AI image…
              </>
            ) : (
              <>
                <Sparkles />
                Generate AI image
                {aiUsage ? ` (${aiUsage.used}/${aiUsage.limit})` : ""}
              </>
            )}
          </Button>

          {aiUsage && aiUsage.used >= aiUsage.limit && (
            <p className="px-1 text-center text-xs text-muted-foreground">
              Generation limit reached ({aiUsage.limit}/{aiUsage.limit}). Convert the DWG again to
              generate more.
            </p>
          )}

          {aiDone && (
            <div className="animate-slide-up">
              <ImagePreviewCard
                src={aiDownloadUrl(result.conversionId)}
                alt={`AI visualization: ${result.fileName}`}
                onToggleBig={() => setLightbox("ai")}
                onDownload={handleAiDownload}
              />
              <Button
                 variant="outline"
                 className="mt-2 h-10 w-full rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-500 hover:to-violet-600 hover:shadow-indigo-500/40 disabled:from-indigo-500/60 disabled:to-violet-500/60"
                 onClick={handleTilesview}
                 disabled={sendingToTilesview}
               >
                 {sendingToTilesview ? <Loader2 className="animate-spin" /> : <MonitorSmartphone />}
                 {sendingToTilesview ? "Sending to TilesView…" : "Send to Visualizer"}
              </Button>

            </div>

          )}
          {tilesviewRoomId !== null && (
            <a className="px-1 text-center text-xs text-muted-foreground"
              href={`https://tilesview.ai/app/EZEnoscu4lODABbT_sHm7Q/visualizer/${tilesviewRoomId}/MySpace`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in Visualizer : {tilesviewRoomId}

            </a>
          )}
        </div>
      </div>

      <ImageLightbox
        open={lightbox !== null}
        onOpenChange={(open) => !open && setLightbox(null)}
        src={lightboxSrc}
        alt={lightbox === "ai" ? "AI visualization preview" : "Converted PNG preview"}
        title={lightbox === "ai" ? "AI Image" : "Converted PNG"}
        subtitle={lightbox === "ai" ? `${result.fileName.replace(/\.png$/i, "")}-ai.png` : result.fileName}
        onDownload={lightbox === "ai" ? handleAiDownload : handleDownload}
        downloadLabel={lightbox === "ai" ? "Download AI image" : "Download PNG"}
      />
    </div>
  );
}
