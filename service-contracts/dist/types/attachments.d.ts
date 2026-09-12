import type { AttachmentKind } from './common';
export interface AttachmentDto {
    id: string;
    appointmentId: string;
    consultationId: string | null;
    uploaderId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    kind: AttachmentKind;
    downloadUrl: string;
    createdAt: string;
}
//# sourceMappingURL=attachments.d.ts.map