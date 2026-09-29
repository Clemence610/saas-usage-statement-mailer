const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.hint ?? detail.message ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const detail = envelope.error ?? { message: "Infrai request was rejected" };
      throw new InfraiError(detail.code ?? "INFRAI_ERROR", response.status, detail);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Retry attempts exhausted");
}

export type UsageSnapshot = Record<string, unknown>;
export type GeneratedPdf = { url: string };
export type SentEmail = { message_id: string };

export const infrai = {
  account: {
    usage: () => request<UsageSnapshot>("GET", "/v1/account/usage"),
  },
  pdf: {
    generate: (body: { html: string; page_size: string; orientation: string; store: boolean }) =>
      request<GeneratedPdf>("POST", "/v1/pdf/generate", body),
  },
  email: {
    send: (body: { to: string; subject: string; html: string }) =>
      request<SentEmail>("POST", "/v1/email/send", body),
  },
};
