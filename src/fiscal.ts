export type FiscalConnectionStatus = "PENDING_AUTHORIZATION" | "ACTIVE" | "REVOKED";

export interface FiscalConnection {
  notificationEmail?: string;
  id: string;
  cnpj: string;
  authorState: string;
  clientUserId: string;
  purpose: string;
  status: FiscalConnectionStatus;
  consentAcceptedAt: string | null;
  consentVersion: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface CreateFiscalConnectionRequest {
  notificationEmail?: string;
  cnpj: string;
  authorState?: string;
  clientUserId: string;
  purpose: string;
}

export interface FiscalConnectToken {
  accessToken: string;
  connectUrl: string;
  expiresAt: string;
}

export interface FiscalPage<T> {
  data: T[];
  nextCursor: string;
}

export interface FiscalDocument {
  accessKey: string;
  type: "NFe" | "CTe" | "NFSe" | "MDFe";
  model: string;
  issuer: { taxId: string; name: string };
  recipient: { taxId: string; name: string };
  totalAmount: number;
  issuedAt: string;
  situation: string;
  completeness: string;
  captureChannel: string;
}

export interface FiscalPageFilters {
  cursor?: string;
  limit?: number;
}

export interface FiscalDocumentFilters extends FiscalPageFilters {
  from?: string;
  to?: string;
  type?: FiscalDocument["type"];
  direction?: "inbound" | "outbound";
}

export interface FiscalChannelStatus {
  channel: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextAllowedRunAt: string | null;
  lastOutcome: string;
  externalBudgetConsumption: boolean;
}

export interface FiscalStatus {
  cnpj: string;
  certificate: { status: string; notAfter: string | null; daysToExpiry: number | null };
  channels: FiscalChannelStatus[];
  coverage: Record<string, string>;
}

export type FiscalWebhookEventType =
  | "fiscal/connection_updated"
  | "fiscal/documents_updated"
  | "fiscal/sync_completed"
  | "fiscal/sync_failed";

export interface FiscalWebhookEvent {
  event: FiscalWebhookEventType;
  eventId: string;
  connectionId: string;
  clientUserId: string;
  cnpj?: string;
  status?: FiscalConnectionStatus;
  documents?: FiscalDocument[];
  documentKeys?: string[];
  cursor?: string;
  channels?: { channel: string; lastRunAt: string | null; outcome: string }[];
  sandbox?: boolean;
  code?: string;
  operation?: string;
}

export interface UpdateFiscalConnectionRequest {
  notificationEmail: string;
}
