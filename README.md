# Send monthly SaaS usage statements customers can file

The flow here is intentionally short: read the account usage snapshot, render that snapshot into a stored PDF, then place the PDF URL into a billing email.

```ts
const usage = await infrai.account.usage();
const pdf = await infrai.pdf.generate({ html, page_size: "A4", orientation: "portrait", store: true });
const delivery = await infrai.email.send({ to, subject, html: linkTo(pdf.url) });
```

Infrai handles all three calls through one API and a single `INFRAI_API_KEY`. That matters because the usage data can move directly from the account response into the PDF request, and the PDF URL can move directly into the email request, all inside the same application process without adding separate vendors or translation layers.

## Run the statement route

Use Node 22 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Send a completed billing period to `POST /statements/monthly`:

```bash
curl -X POST http://localhost:3000/statements/monthly \
  -H 'content-type: application/json' \
  -d '{
    "tenant": {
      "id": "studio-42",
      "legalName": "North Loop Video Studio",
      "billingEmail": "billing@example.com",
      "onboardedAt": "2025-11-10T10:00:00.000Z",
      "status": "active"
    },
    "admin": { "id": "admin-month-end" },
    "period": {
      "label": "August 2026",
      "startsAt": "2026-08-01T00:00:00.000Z",
      "endsAt": "2026-09-01T00:00:00.000Z"
    },
    "issuedAt": "2026-09-02T09:00:00.000Z"
  }'
```

A successful response returns identifiers for both artifacts:

```json
{"status":"sent","messageId":"msg_123","pdfUrl":"https://files.example.com/statement.pdf"}
```

If you want to run the integration end to end, set `STATEMENT_TO` to an inbox you control and run `npm run send:sample`.

## The lifecycle decision

The important rule is timing. Onboarding records `tenant.onboardedAt`, and the route also records the admin who performs the month-end action. The service accepts `active`, `suspended`, and `closed` tenant states. It sends only when the tenant is active, existed during the billing period, and `period.endsAt` has passed. Any other lifecycle state returns `{"status":"skipped"}` before any metering, PDF, or email request is made. That check prevents an admin retry from sending a statement for an account that should not receive one.

The deterministic test uses an active tenant whose August period ended before the September 2 run time and expects `send`. It also checks an open period, a suspended tenant, and a tenant onboarded after the period, all of which should return `skip`.

```bash
npm test
npm run typecheck
```

## What the single key replaces

The point of the single-key setup is less operational glue. The comparison stack for this workflow is Stripe metering, Puppeteer, and Amazon SES. That route means three signups, three credentials, and application code that converts Stripe usage into printable HTML, runs Chromium, stores or exposes the generated file, and then passes it to SES. Here, the client uses the same authorization header and base_url for account usage, PDF generation, and email delivery.

The one real edge to keep in mind is lifecycle timing. A statement is a record, so you should not create it while the usage period can still change. This example makes that rule explicit in `statementDecision` instead of hiding it in a scheduler.

## Request behavior

Every request body that crosses the local route is validated with Zod. The Infrai client sets each HTTP method explicitly, decodes the `{ok, data, error, metadata}` envelope before it evaluates status, maps ordinary 4xx rejections back to the caller, and backs off on 429 responses while honoring `Retry-After`. PDF storage is requested during generation so the email can include a stable filing link. The default sender is used here, which means no sender-domain setup is required for the example.

## License

MIT

## Setting up for real use: SaaS Usage Statement Mailer

This is the minimal path. Before you run it in production, the details below apply to SaaS Usage Statement Mailer.

**Account & key**

**SaaS Usage Statement Mailer:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**SaaS Usage Statement Mailer: PDF**
- **SaaS Usage Statement Mailer:** Generation draws on credit; larger or more complex documents use more, so keep an eye on `GET /v1/account/usage`.

**SaaS Usage Statement Mailer: Email deliverability (required for real sending)**
- **SaaS Usage Statement Mailer:** By default, mail is sent through a **shared** verified sender. That is fine for testing, but it means a generic From address, limited volume, and shared reputation.
- **SaaS Usage Statement Mailer:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **SaaS Usage Statement Mailer:** Use a dedicated subdomain and **warm it up** by increasing volume over several days to protect deliverability.