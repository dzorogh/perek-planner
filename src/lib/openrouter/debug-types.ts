export type AiDebugMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiDebugEntry = {
  id: string;
  at: string;
  model: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  requestMessages: AiDebugMessage[];
  response: string | null;
};
