import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { File, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { previewSketch } from "@/lib/sketches.functions";
import { sketchPreviewFormat } from "@/lib/sketches.preview";

export function SketchPreview({
  file,
  onClose,
}: {
  file: { path: string; name: string } | null;
  onClose: () => void;
}) {
  const preview = useServerFn(previewSketch);
  const [content, setContent] = useState<{ url: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const format = file ? sketchPreviewFormat(file.name) : null;

  useEffect(() => {
    setContent(null);
    setError("");
    if (!file || !format) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      if (!file || !format) return;
      try {
        const signed = await preview({ data: { path: file.path } });
        if (controller.signal.aborted) return;
        const response = await fetch(signed.url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Podgląd niedostępny.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (format.kind === "text") {
          const text = await blob.slice(0, 1024 * 1024).text();
          if (!controller.signal.aborted)
            setContent({
              url: "",
              text:
                text +
                (blob.size > 1024 * 1024
                  ? "\n\n[… dalsza część pliku pominięta w podglądzie]"
                  : ""),
            });
        } else {
          if (format.kind === "pdf" && !(await blob.slice(0, 5).text()).startsWith("%PDF-"))
            throw new Error("Nieprawidłowy PDF.");
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(new Blob([blob], { type: format.mime }));
          setContent({ url: objectUrl, text: "" });
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Nie udało się wyświetlić pliku. Format może być nieobsługiwany lub plik jest uszkodzony.",
          );
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, preview]);

  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sketch-space flex h-[85dvh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-4 rounded-md p-4 text-foreground sm:p-6"
        aria-describedby={undefined}
      >
        <DialogTitle className="shrink-0 break-all pr-8 leading-6 tracking-normal">
          {file?.name}
        </DialogTitle>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md border border-border bg-background">
          {!format ? (
            <div className="flex flex-col items-center gap-4 p-6 text-center text-muted-foreground">
              <File className="size-8" />
              <p>Ten format nie ma podglądu w przeglądarce.</p>
            </div>
          ) : error ? (
            <p role="alert" className="p-6 text-center text-destructive">
              {error}
            </p>
          ) : !content ? (
            <LoaderCircle
              aria-label="Ładowanie podglądu"
              className="size-8 animate-spin text-primary"
            />
          ) : format.kind === "image" ? (
            <img
              src={content.url}
              alt={file?.name}
              className="max-h-full max-w-full object-contain"
              onError={() => setError("Nie udało się wyświetlić obrazu.")}
            />
          ) : format.kind === "pdf" ? (
            <iframe src={content.url} title={file?.name} className="h-full w-full border-0" />
          ) : format.kind === "video" ? (
            <video
              src={content.url}
              controls
              className="max-h-full w-full"
              onError={() => setError("Przeglądarka nie obsługuje tego nagrania.")}
            />
          ) : format.kind === "audio" ? (
            <audio
              src={content.url}
              controls
              className="w-full max-w-lg"
              onError={() => setError("Przeglądarka nie obsługuje tego nagrania.")}
            />
          ) : (
            <pre className="h-full w-full whitespace-pre-wrap break-words p-4 font-mono text-sm">
              {content.text}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
