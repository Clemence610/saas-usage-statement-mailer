import { z } from "zod";
import { infrai, type UsageSnapshot } from "./infrai.js";

export const statementRequestSchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    legalName: z.string().min(1),
    billingEmail: z.string().email(),
    onboardedAt: z.string().datetime(),
    status: z.enum(["active", "suspended", "closed"]),
  }),
  admin: z.object({ id: z.string().min(1) }),
  period: z.object({
    label: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }),
  issuedAt: z.string().datetime(),
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export function statementDecision(input: StatementRequest, now = new Date()): "send" | "skip" {
  const periodEnded = new Date(input.period.endsAt).getTime() <= now.getTime();
  const tenantExisted = new Date(input.tenant.onboardedAt).getTime() <= new Date(input.period.endsAt).getTime();
  return input.tenant.status === "active" && tenantExisted && periodEnded ? "send" : "skip";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] as string);
}

export function renderStatement(input: StatementRequest, usage: UsageSnapshot): string {
  return `<!doctype html><html><body>
    <h1>Monthly usage statement</h1>
    <p><strong>${escapeHtml(input.tenant.legalName)}</strong> (${escapeHtml(input.tenant.id)})</p>
    <p>Requested by admin ${escapeHtml(input.admin.id)}</p>
    <p>Period: ${escapeHtml(input.period.label)}</p>
    <p>${escapeHtml(input.period.startsAt)} through ${escapeHtml(input.period.endsAt)}</p>
    <h2>Metered usage</h2>
    <pre>${escapeHtml(JSON.stringify(usage, null, 2))}</pre>
    <p>Issued ${escapeHtml(input.issuedAt)}</p>
  </body></html>`;
}

export async function sendMonthlyStatement(input: StatementRequest) {
  if (statementDecision(input) === "skip") return { status: "skipped" as const };

  const usage = await infrai.account.usage();
  const pdf = await infrai.pdf.generate({
    html: renderStatement(input, usage),
    page_size: "A4",
    orientation: "portrait",
    store: true,
  });
  const delivery = await infrai.email.send({
    to: input.tenant.billingEmail,
    subject: `${input.period.label} usage statement`,
    html: `<p>Your ${escapeHtml(input.period.label)} usage statement is ready to file.</p><p><a href="${escapeHtml(pdf.url)}">Download PDF</a></p>`,
  });

  return { status: "sent" as const, messageId: delivery.message_id, pdfUrl: pdf.url };
}
