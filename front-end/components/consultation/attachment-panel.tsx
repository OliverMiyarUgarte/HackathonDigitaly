"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Paperclip, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { API_BASE_URL, getAccessToken, postMultipart } from "@/lib/api";
import { attachmentSchema, type AttachmentDto } from "@/lib/contracts";
import { formatBytes } from "@/lib/format";

const ACCEPTED_TYPES =
  "application/pdf,image/png,image/jpeg,image/webp,text/plain";

export interface AttachmentPanelProps {
  appointmentId: string;
  consultationId: string;
  attachments: AttachmentDto[];
  loading: boolean;
  onUploaded: (attachment: AttachmentDto) => void;
}

export function AttachmentPanel({
  appointmentId,
  consultationId,
  attachments,
  loading,
  onUploaded,
}: AttachmentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("consultationId", consultationId);
      const created = await postMultipart(
        `/appointments/${appointmentId}/attachments`,
        formData,
        attachmentSchema,
      );
      onUploaded(created);
    } catch {
      setError(
        "Não foi possível enviar o arquivo. Use PDF, imagem ou texto de até 10 MB.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentDto): Promise<void> => {
    setError(null);
    setDownloadingId(attachment.id);
    try {
      const url = new URL(attachment.downloadUrl, API_BASE_URL).toString();
      const token = getAccessToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error("DOWNLOAD_FAILED");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Não foi possível baixar o arquivo.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section
      id="attachment-panel"
      data-testid="attachment-panel"
      aria-label="Anexos do atendimento"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-bg-elev p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip aria-hidden="true" className="size-4 text-celeste-500" />
          <h3 className="text-base font-medium text-texto">Anexos</h3>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleSelect}
          data-testid="attachment-input"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          {uploading ? "Enviando..." : "Enviar arquivo"}
        </Button>
      </header>

      {error ? (
        <Alert variant="error" title="Anexos">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-texto-3">Carregando anexos...</p>
      ) : attachments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum anexo"
          description="Envie documentos e imagens para compartilhar durante o atendimento."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-borda">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-sm text-texto">
                  {attachment.fileName}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{attachment.kind}</Badge>
                  <span className="font-data text-xs text-texto-3">
                    {formatBytes(attachment.sizeBytes)}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={downloadingId === attachment.id}
                aria-label={`Baixar ${attachment.fileName}`}
                onClick={() => void handleDownload(attachment)}
              >
                <Download aria-hidden="true" />
                {downloadingId === attachment.id ? "Baixando..." : "Baixar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
