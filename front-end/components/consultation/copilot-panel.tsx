"use client";

import { AlertTriangle, AudioLines, Sparkles, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AiStatus,
  CopilotInsight,
  TranscriptSegment,
} from "@/lib/realtime/types";
import { formatTime } from "@/lib/format";
import type { FeedbackSeverity } from "@telemed/service-contracts";

const SEVERITY_ORDER: FeedbackSeverity[] = ["critical", "warning", "info"];

const SEVERITY_LABEL: Record<FeedbackSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Informativo",
};

const SEVERITY_ALERT: Record<
  FeedbackSeverity,
  "error" | "warning" | "info"
> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

const SEVERITY_BADGE: Record<
  FeedbackSeverity,
  "error" | "warning" | "brand"
> = {
  critical: "error",
  warning: "warning",
  info: "brand",
};

const AI_STATUS_LABEL: Record<AiStatus, string> = {
  connecting: "Copiloto conectando",
  ready: "Copiloto ativo",
  unavailable: "Copiloto indisponível",
};

const AI_STATUS_VARIANT: Record<AiStatus, "brand" | "success" | "warning"> = {
  connecting: "brand",
  ready: "success",
  unavailable: "warning",
};

export interface CopilotPanelProps {
  partial: string | null;
  segments: TranscriptSegment[];
  insights: CopilotInsight[];
  aiStatus: AiStatus;
  isStreaming: boolean;
  level: number;
  audioError: string | null;
  onStartAudio: () => void;
  onStopAudio: () => void;
  onClear: () => void;
}

export function CopilotPanel({
  partial,
  segments,
  insights,
  aiStatus,
  isStreaming,
  level,
  audioError,
  onStartAudio,
  onStopAudio,
  onClear,
}: CopilotPanelProps) {
  const suggestedActions = Array.from(
    new Set(insights.flatMap((insight) => insight.tags)),
  ).slice(0, 6);

  return (
    <section
      data-testid="copilot-panel"
      aria-label="Copiloto clínico"
      className="flex flex-col gap-4 rounded-lg border border-borda bg-bg-elev p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-celeste-500" />
          <h3 className="text-base font-medium text-texto">Copiloto</h3>
        </div>
        <Badge
          variant={AI_STATUS_VARIANT[aiStatus]}
          live={aiStatus === "connecting"}
          data-testid="copilot-status"
        >
          {AI_STATUS_LABEL[aiStatus]}
        </Badge>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={isStreaming ? "secondary" : "primary"}
            onClick={isStreaming ? onStopAudio : onStartAudio}
            data-testid="toggle-copilot-audio"
          >
            <AudioLines aria-hidden="true" />
            {isStreaming ? "Pausar escuta" : "Ativar escuta"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            aria-label="Limpar copiloto"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
        <div
          role="meter"
          aria-label="Nível do microfone"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
          className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-elev-2"
        >
          <div
            className="h-full rounded-pill [background-image:var(--grad-marca)] transition-[width] duration-100"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      </div>

      {audioError ? (
        <Alert variant="warning" title="Áudio do copiloto">
          {audioError}
        </Alert>
      ) : null}

      {aiStatus === "unavailable" ? (
        <Alert variant="warning" title="Copiloto indisponível">
          A transcrição e as sugestões automáticas estão fora do ar. O
          atendimento por vídeo continua normalmente.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-texto-2">Transcrição</h4>
        {partial || segments.length > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border border-borda bg-bg p-3 text-sm">
            {segments.map((segment) => (
              <p key={segment.id} className="mb-2 text-texto-2 last:mb-0">
                <span className="mr-2 font-data text-xs text-texto-3">
                  {formatTime(segment.at)}
                </span>
                {segment.text}
              </p>
            ))}
            {partial ? (
              <p className="border-l-2 border-celeste-500 pl-2 italic text-texto">
                {partial}
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={AudioLines}
            title="Aguardando o copiloto"
            description={
              aiStatus === "connecting"
                ? "A transcrição aparece aqui assim que a sessão de áudio conectar."
                : "Nenhuma transcrição registrada até agora."
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-medium text-texto-2">Insights</h4>
        {insights.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Nenhum insight ainda"
            description="As sugestões clínicas aparecem conforme a conversa avança."
          />
        ) : (
          SEVERITY_ORDER.map((severity) => {
            const grouped = insights.filter(
              (insight) => insight.severity === severity,
            );
            if (grouped.length === 0) {
              return null;
            }
            return (
              <div key={severity} className="flex flex-col gap-2">
                <Badge variant={SEVERITY_BADGE[severity]}>
                  {SEVERITY_LABEL[severity]}
                </Badge>
                {grouped.map((insight) => (
                  <Alert
                    key={insight.id}
                    variant={SEVERITY_ALERT[severity]}
                    title={insight.message}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-data text-xs text-texto-3">
                        {formatTime(insight.at)}
                      </span>
                      {insight.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Alert>
                ))}
              </div>
            );
          })
        )}
      </div>

      {suggestedActions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-texto-2">Ações sugeridas</h4>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <Badge key={action} variant="brand">
                {action}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
