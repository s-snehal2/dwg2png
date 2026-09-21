import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="mt-5 flex w-full animate-fade-in items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive"
    >
      <AlertCircle className="relative mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">Something went wrong</p>
        <p className="mt-0.5 text-[13px] leading-snug text-destructive/90">{message}</p>
      </div>
    </div>
  );
}