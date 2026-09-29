import assert from "node:assert/strict";
import test from "node:test";
import { statementDecision, statementRequestSchema } from "../src/usage_statement.js";

const baseRequest = {
  tenant: {
    id: "studio-42",
    legalName: "North Loop Video Studio",
    billingEmail: "billing@example.com",
    onboardedAt: "2025-11-10T10:00:00.000Z",
    status: "active" as const,
  },
  admin: { id: "admin-month-end" },
  period: {
    label: "August 2026",
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
  },
  issuedAt: "2026-09-02T09:00:00.000Z",
};

test("sends a statement for an active tenant after the period closes", () => {
  const input = statementRequestSchema.parse(baseRequest);
  assert.equal(statementDecision(input, new Date("2026-09-02T09:00:00.000Z")), "send");
});

test("does not send while the usage period is still open", () => {
  const input = statementRequestSchema.parse(baseRequest);
  assert.equal(statementDecision(input, new Date("2026-08-20T09:00:00.000Z")), "skip");
});

test("does not send for a suspended tenant", () => {
  const input = statementRequestSchema.parse({
    ...baseRequest,
    tenant: { ...baseRequest.tenant, status: "suspended" },
  });
  assert.equal(statementDecision(input, new Date("2026-09-02T09:00:00.000Z")), "skip");
});

test("does not issue a statement for a period before tenant onboarding", () => {
  const input = statementRequestSchema.parse({
    ...baseRequest,
    tenant: { ...baseRequest.tenant, onboardedAt: "2026-09-10T10:00:00.000Z" },
  });
  assert.equal(statementDecision(input, new Date("2026-09-12T09:00:00.000Z")), "skip");
});
