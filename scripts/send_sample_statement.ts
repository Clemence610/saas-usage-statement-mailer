import { sendMonthlyStatement, statementRequestSchema } from "../src/usage_statement.js";

const sample = statementRequestSchema.parse({
  tenant: {
    id: "studio-42",
    legalName: "North Loop Video Studio",
    billingEmail: process.env.STATEMENT_TO ?? "billing@example.com",
    onboardedAt: "2025-11-10T10:00:00.000Z",
    status: "active",
  },
  admin: { id: "admin-month-end" },
  period: {
    label: "August 2026",
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
  },
  issuedAt: "2026-09-02T09:00:00.000Z",
});

console.log(await sendMonthlyStatement(sample));
