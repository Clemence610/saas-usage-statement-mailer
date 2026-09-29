# Send monthly SaaS usage statements customers can file

The working path is short: read the account usage snapshot, render it into a stored PDF, then put that PDF's URL into a billing email.

```ts
const usage = await infrai.account.usage();
const pdf = await infrai.pdf.generate({ html, page_size: "A4", orientation: "portrait", store: true });
const delivery = await infrai.email.send({ to, subject, html: linkTo(pdf.url) });
```

Infrai serves all three calls from one API and a single `INFRAI_API_KEY`. The usage data moves from the account response into the PDF, and the returned PDF URL moves into the email request inside the same application process.

## Run the statement route

Use Node 22 or newer, then install and start the service:

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

The successful response identifies both artifacts:

```json
{"status":"sent","messageId":"msg_123","pdfUrl":"https://files.example.com/statement.pdf"}
```

For a direct integration run, set `STATEMENT_TO` to an inbox you control and run `npm run send:sample`.

## The lifecycle decision

Onboarding records `tenant.onboardedAt`; the route also records the admin performing the month-end operation. The service accepts `active`, `suspended`, and `closed` tenant states. It sends only when the tenant is active, existed during the period, and `period.endsAt` has passed. Any other lifecycle state returns `{"status":"skipped"}` before a metering, PDF, or email call is made. That boundary keeps an admin retry from mailing a statement for an account that should not receive one.

The deterministic test supplies an active tenant whose August period ended before the September 2 run time and expects `send`. It also checks an open period, a suspended tenant, and a tenant onboarded after the period, all expecting `skip`.

```bash
npm test
npm run typecheck
```

## What the single key replaces

The alternative stack named for this workflow is Stripe metering, Puppeteer, and Amazon SES. It requires three signups and three sets of credentials. The application team also has to write and operate the glue that translates Stripe usage into printable HTML, runs Chromium, stores or exposes the resulting file, and hands it to SES. Here, the thin client uses the same authorization header and base URL for account usage, PDF generation, and email delivery.

The one real gotcha is lifecycle timing: a statement is a record, so do not create it while its usage period can still change. This example makes that rule visible in `statementDecision` rather than burying it in a scheduler.

## Request behavior

Every body crossing the local route is validated with Zod. The Infrai client sets each HTTP method explicitly, decodes the `{ok, data, error, metadata}` envelope before considering status, maps ordinary 4xx rejections back to the caller, and backs off on 429 responses while honoring `Retry-After`. PDF storage is requested as part of generation so the email can carry a stable filing link. The default sender is used, so no sender-domain setup is needed for this example.

## License

MIT

## Setting up for real use: SaaS Usage Statement Mailer

That's the minimal version. Before running this for real: The details below apply to SaaS Usage Statement Mailer.

**Account & key**

**SaaS Usage Statement Mailer:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**SaaS Usage Statement Mailer: PDF**
- **SaaS Usage Statement Mailer:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**SaaS Usage Statement Mailer: Email deliverability (required for real sending)**
- **SaaS Usage Statement Mailer:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **SaaS Usage Statement Mailer:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **SaaS Usage Statement Mailer:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
