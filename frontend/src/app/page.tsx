"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import ConverterCard from "@/components/ConverterCard";
import type { ConversionResult as ConversionResultData } from "@/types/conversion";
import type { ProgressStep } from "@/components/ConversionProgress";
import { convertDwg } from "@/services/api";

const MAX_MB = 50;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [step, setStep] = useState<ProgressStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResultData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const resetFromCancel = useCallback(() => {
    setConverting(false);
    setStep("upload");
    setError(null);
    setResult(null);
  }, []);

  const cancelConversion = useCallback(() => {
    cancelInFlight();
    resetFromCancel();
    toast.info("Conversion cancelled.");
  }, [cancelInFlight, resetFromCancel]);

  const selectFile = useCallback(
    (candidate: File) => {
      if (!candidate.name.toLowerCase().endsWith(".dwg")) {
        setError("Only .dwg files are supported.");
        return;
      }
      if (candidate.size > MAX_MB * 1024 * 1024) {
        setError(`File is larger than the ${MAX_MB}MB limit.`);
        return;
      }
      cancelInFlight();
      setFile(candidate);
      setError(null);
      setResult(null);
      setStep("upload");
    },
    [cancelInFlight]
  );

  const clearFile = useCallback(() => {
    cancelInFlight();
    setFile(null);
    setError(null);
    setResult(null);
    setStep("upload");
  }, [cancelInFlight]);

  const reset = useCallback(() => {
    clearFile();
    setConverting(false);
  }, [clearFile]);

  const runConversion = useCallback(async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setConverting(true);
    setError(null);
    setResult(null);
    setStep("parse");

    try {
      const converted = await convertDwg(file, { signal: controller.signal });
      setStep("render");
      setResult(converted);
      setStep("done");
      toast.success("Conversion complete. Your PNG is ready.");
    } catch (err) {
      if (isAbortError(err)) {
        resetFromCancel();
        return;
      }
      const message = err instanceof Error ? err.message : "Conversion failed.";
      setError(message);
      setStep("upload");
      toast.error(message);
    } finally {
      setConverting(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [file, resetFromCancel]);

  return (
    <main className="mx-auto flex w-full max-w-[min(92vw,760px)] flex-1 items-center justify-center overflow-hidden px-1 py-4">
      <ConverterCard
        file={file}
        converting={converting}
        step={step}
        error={error}
        result={result}
        maxMb={MAX_MB}
        onFile={selectFile}
        onClear={clearFile}
        onConvert={runConversion}
        onCancel={cancelConversion}
        onReset={reset}
      />
    </main>
  );
}