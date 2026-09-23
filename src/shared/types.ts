// Shared types between worker and UI

export type Role = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  created_at: number;
}

export interface Capability {
  id: string;
  name: string;
  version: string;
  enabled: number;
  config: string;
  manifest: string;
  created_at: number;
  updated_at: number;
}

export type OperationStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "rejected"
  | "rolled_back";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Operation {
  id: string;
  capability_id?: string;
  operation_type: string;
  actor: string;
  status: OperationStatus;
  input: string;
  output?: string;
  error?: string;
  risk: RiskLevel;
  requires_approval: number;
  approved_by?: string;
  approved_at?: number;
  started_at?: number;
  finished_at?: number;
  created_at: number;
}

export interface RaymondEvent {
  id: string;
  topic: string;
  payload: string;
  source?: string;
  status: "pending" | "processing" | "delivered" | "failed";
  attempts: number;
  error?: string;
  created_at: number;
  processed_at?: number;
}

export interface ChatRequest {
  conversation_id?: string;
  message: string;
  provider?: string;
  model?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
}
