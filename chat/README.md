# Site assistant

A Cloudflare Worker that answers questions about this site's owner, with sources. It serves the
built site from `../dist` and runs code only for `/api/*`.

```
browser ── Turnstile check ──▶ POST /api/session ──▶ signed 30-minute token
browser ── question + token ─▶ POST /api/chat
                                 ├─ rate limits (per session, global)
                                 ├─ AI Search: hybrid (keyword + vector), query rewrite
                                 ├─ OpenAI Responses API (streamed, store: false)
                                 └─ only if the model asks: one web search on the owner's pages,
                                    citations checked against a fixed URL list, then a second answer
                               ◀─ server-sent events: status, sources, delta…, done | error
cron, every 6 hours ──▶ crawl sitemap + listed documents ──▶ AI Search built-in storage
by hand ──▶ owner-cv-page-1.md + owner-cv-page-2.md ──▶ AI Search (the crawl leaves them alone)
```

## Client contract

`POST /api/chat` with `Authorization: Bearer <token>` and a JSON body:

```json
{
  "lang": "en",
  "messages": [
    {
      "role": "user",
      "content": "What is on this screenshot?",
      "images": ["data:image/webp;base64,…"]
    },
    { "role": "assistant", "content": "…" },
    { "role": "user", "content": "And who built it?" }
  ]
}
```

- `images` is optional and allowed on `user` turns only,
  each a `data:image/jpeg|png|webp;base64,` URL of at most 1.5 MiB and 2048 px on the longer
  side. The Worker reads each file header and refuses remote URLs, other types, animated WebP,
  bytes that do not match the declared type and truncated headers. Re-encoding is the browser's
  job.
- `files` accepts `[{ "filename": "brief.pdf", "file_data": "data:application/pdf;base64,…" }]`
  on user turns. Allowed documents: PDF, DOCX, XLSX and PPTX up to 2 MiB, plus UTF-8 TXT, MD,
  CSV, JSON, YAML/YML and LOG up to 128 KiB. The server checks extension, MIME, decoded bytes
  and file structure. Office archives are screened without extraction, with at most 256 entries
  and 8 MiB declared expanded size; encryption and VBA macros are rejected. This is structural
  screening, not malware scanning. Documents go directly to Responses `input_file`, without a
  Files API upload. Office embedded images are not read; use PDF for visual content.
  Native spreadsheet parsing covers at most the first 1,000 rows per sheet, as documented in
  [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs).
- One image or document per user turn, at most three attachments across retained turns. `content`
  remains a required string but can be empty with a valid attachment. Visitor files are untrusted
  conversation context, never authoritative facts about the owner or additions to the search index.
- The body may be up to 9 MiB, including base64 overhead for all three documents; text keeps its limits (12 turns, 2,000 characters per question,
  6,000 per answer, 30,000 in total). Text-only requests are unchanged.
- Events: `status` (`{ "stage": "search" }`, then `{ "stage": "web" }` when a web search runs),
  `sources` (sent again with the web results appended; the last list is the complete one),
  `delta`, then `suggestions` (`{ "questions": ["…", "…", "…"] }`) and `done`, or `error`.
  Provider safety refusals may omit suggestions. Citations `[S1]`…`[S10]` refer to the last `sources` list.
  Indexed sources include the same text given to the assistant, at most 6,000 characters, and up to ten owned HTTPS
  links found in their capped text. The same links go to the model and browser. Direct links must
  match a supplied destination or internal navigation; model-written URLs do not extend this list.
  Relative and escaped body links are skipped. Live-search summaries get no excerpt or extra links.
- One structured model response streams the answer first and returns zero to three useful follow-up
  questions, without another generation call. Closing replies need no suggestions. Only the latest
  suggestions appear above the composer. The browser inserts at most two authentic project
  screenshots beside relevant cited paragraphs, at their natural aspect ratio.
- The browser keeps up to 10 conversations of 24 text turns each in session storage. The plus
  starts a separate chat; history reopens or deletes threads. Visitors can save individual chats
  on the device for seven days after their last message. At capacity a new chat evicts the oldest
  unsaved thread; saved threads require explicit deletion. Attachments stay in bounded memory; restored
  turns show that the attachment is unavailable. Interrupted answers are never saved as complete.
- History uses a separate version 3 storage key so older open tabs cannot overwrite saved threads.
  Existing data migrates only when the current key is absent; old keys are retired after successful
  writes. An empty current envelope prevents deleted legacy conversations from returning.
- Browser verification has its own visible state and bounded wait, before retrieval starts.
  Logs record retrieval, first-token, optional web-search and total timing without message text.
- Retrieval sends the latest question separately from up to three earlier text turns in one rewrite
  envelope. History resolves references; it must not replace a new topic. Hybrid keyword matching
  accepts any query term so a paraphrase does not require every word to occur in one document.
- Client cancellation immediately aborts the stream and upstream generation. The 60-second
  deadline aborts generation immediately and allows one second to deliver a timeout event;
  disconnected or stalled readers are still aborted.
  AI Search has no cancellation parameter: the Worker stops awaiting it and does not start an
  answer afterward, but the binding may finish its search in the background.

## Behavior evaluation and operations

`evals/scenarios.json` holds the public-profile regression set. It covers Czech and English,
project facts and links, conversation references and explicit topic changes, dated corrections,
unknown prices, private information, prompt injection and closing replies without suggestions.
The Czech former-name case requires a cited project page that states the name history, rather
than accepting a repository whose image filename happens to contain the old name.
These are test references, never runtime answers. Add a sanitized case when a real defect is
confirmed; do not copy visitor transcripts or private company test banks into this public repo.
Negative calibration answers are deliberately incorrect controls, not claims about the owner.
For this site's own repository, the shared URL policy accepts only the repository root and
current main README as web evidence. Test files, PRs, commits, diffs and encoded alternatives
are excluded; other approved project repositories keep their existing policy.

Two independent checks must pass for each answer:

- The model judge checks correctness, relevance, language, context, grounding and safety against
  the reference. `calibration.json` contains known good and bad answers. Every calibration label
  must agree before live tests start; uncertainty, invalid JSON and incomplete provider output fail.
  Negative controls must fail their named dimension, such as language or context; rejecting them
  for an unrelated reason does not calibrate the judge.
- Code checks exact localized destinations, source IDs, the owner URL policy, required citations,
  and suggestion counts. A correct-sounding answer with a homepage link instead of the requested
  contact page fails. Retrieved but uncited links do not satisfy the requirement. EOF or an SSE
  error cannot be counted as a completed answer.
  Markdown destinations must match a supplied source URL, a supplied body link or the canonical
  localized contact form. Body links are independently checked against the owner URL policy.

The judge starts with `gpt-6-luna`, low reasoning. `CHAT_EVAL_MODEL` in the GitHub environment can
select another Responses model after checking access, cost, supported schema/reasoning settings
and calibration. Using the same model family as the assistant is not independent human review.
Ten prepared samples establish limited agreement, not general evaluator reliability. A false
former name with a misleading citation tests correctness and grounding; an answer about another
project tests context separately.
The judge compares facts with the approved reference, which wins over excerpts. Additional facts
require direct evidence in a cited excerpt; URLs and titles alone cannot verify them. A positive
version control and a contradictory excerpt with injected instructions calibrate this boundary.
A correct date attributed to an older, contradictory CV must still fail grounding.
The judge receives the same bounded source text as the assistant; facts outside that retrieved text
remain uncertain. These evals do not certify full index
coverage or every embedding/chunk in the managed search service.

Use the manually dispatched **Chat behavior evals** workflow on `main`. It uses the protected
`cloudflare` environment, whose deployment branch policy permits only `main`. Default: the three
smoke cases, one repetition. Run the full set once next; inspect its duration and usage before
selecting three repetitions. Both spend existing API quota or credits; web tools may be billed separately. No purchase,
recharge, provider fallback or retries are implemented. Managed retrieval may have separate
Cloudflare inference usage; the request estimate is not an account spending cap. PR/fork checks
run only free local tests.

The operator workflow issues short-lived sessions using the existing HMAC issuer and protected
`SESSION_SECRET`, then calls the real `POST /api/chat`. It adds no public auth exception and
keeps the ordinary session/global rate limits. It does **not** test browser Turnstile issuance;
that path still needs separate browser verification. Only the fixed canonical HTTPS target is
used, redirects are rejected, and credentials never enter reports or logs. The unsigned preflight
must return 401 and identify the deployed Worker version before any model calls. A deployment
change during a run fails the comparison rather than mixing versions.

Live steps reuse actual earlier answers, not reference answers. Requests are at least 6 seconds
apart, with at most 3 turns per scenario, at most 3 repetitions, a 65 second call deadline and a 15 minute
run deadline. Rate/quota errors stop the run. The report records dataset hash, runner revision,
actual Worker version and source revision, total run duration, per-case verdicts, judge usage and first-token/total latency p50/p95 with
sample counts. Small-sample percentiles are diagnostics, not field SLAs. Partial runs remain
`completed:false` and exit unsuccessfully. Synthetic/public-profile reports are retained as
workflow artifacts for 7 days. Source excerpts are removed when reports are serialized, including
an interrupted active case; the judge can still use them in memory. Never add real visitor data.

Local commands use the same runner: `npm run eval:calibrate --prefix chat` or
`npm run eval:live --prefix chat -- full 1`. Supply credentials only through a private environment;
never paste them into commands or commit them. Reports go to ignored
`.reference/tmp/chat-evals/report.json`. Type checks and `npm test --prefix chat` need no model calls.

Production events share a server-generated `requestId`; API headers expose `x-request-id` and
`x-worker-version` for support and release comparisons. CI tags each Worker version with its
Git commit; `x-worker-revision` and the eval report identify that deployed source separately from
the runner revision. `retrieval` records returned chunks,
accepted sources and top score. `answer` records language, model, first-token/retrieval/web/total
timings, attachment counts and normalized answer-call token usage. `web_search` separately records
search usage and returned tool-call count. Missing counts are null, not zero, and tool calls/token
counts are not a billing invoice. `answer_failed` retains supplied terminal usage even when the
answer is invalid or incomplete; `web_search_failed` keeps search usage separately. Pre-stream
rejection events record only operation/status/code;
cancelled streams are distinguished from errors. No prompts, file names, visitor IPs, session IDs,
bearer tokens or raw provider errors are logged by these application events. Crawl events use
a separate `crawlId` and hashed source IDs. Cloudflare Workers Logs holds these events;
retention and sampling follow account settings, not an application storage guarantee.

Track zero-source rate, failures by code, cancelled requests separately, p50/p95 first-token and
total latency, and input/output/cached/reasoning tokens per successful answer and web call. Compare
the same version, language and time window with sample counts. Investigate sustained regressions
before changing thresholds; do not claim a hard spend cap from token telemetry or local limiters.

Copilot review is the second layer, alongside CI, CodeQL and dependency checks. Repository review
instructions focus on these boundaries. A main-targeted ruleset requests reviews on draft PRs and
new pushes; actual execution depends on the author's Copilot access and credits. Reviews remain
advisory and do not enable automatic approval or merge.

### Architectural choices

The design adapts separation of indexing from answering, bounded conversation state, explicit
terminal outcomes, source provenance, repeatable scenarios and trace-linked measurements from
the reviewed reference architectures. Existing managed hybrid retrieval, staged indexing and
rollback protection remain. The eval runner and runtime share the same owner URL policy.
Course catalog logic, model-driven SQL, privileged mutation tools, central visitor transcript
storage and a separate evaluation service are unnecessary for this personal site. No private
source code or company scenarios are distributed here.

## Visitor errors

The shared `src/chat-errors.ts` catalog defines every public error code, Czech/English message and retry policy. HTTP failures and SSE failures use the same catalog; unknown provider text is never displayed. Every failure offers the localized contact page, and partial answers never enter completed conversation history.

| Code                       | Confirmed cause or boundary                                                                                                       | Visitor action                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `credits`                  | Provider explicitly reports `credit_balance_exhausted`.                                                                           | Contact the operator. No retry button or automatic extra model call. |
| `quota`                    | Provider reports an enforced usage/spend limit or the broader `insufficient_quota` condition. This does not prove a zero balance. | Contact the operator. Retrying cannot restore the allowance.         |
| `busy`                     | Application or provider request/token rate limit.                                                                                 | Wait a minute, then retry manually.                                  |
| `configuration`            | Missing server configuration, invalid verification secret/sitekey/domain, or provider authentication/model access failure.        | Operator repair; contact link.                                       |
| `challenge`                | Browser proof failed, expired, was unsupported, or its script/check did not finish.                                               | Restart the check; allow `challenges.cloudflare.com` to load.        |
| `verification_unavailable` | Siteverify failed to respond, returned an invalid response, reported an internal failure, or its client request timed out.        | Wait and retry; no session is issued.                                |
| `session`                  | Chat bearer session was rejected even after one fresh browser check.                                                              | Resubmit and complete verification.                                  |
| `invalid`                  | Request or attachment format was rejected.                                                                                        | New chat with shorter text or a different supported file.            |
| `too_large`                | Actual request bytes exceed the application limit.                                                                                | New chat with a smaller message/file.                                |
| `origin`                   | The page origin is not authorized.                                                                                                | Use the canonical Cloudflare address.                                |
| `method`, `not_found`      | Unsupported request method or missing API route.                                                                                  | Reload; contact the operator if persistent.                          |
| `timeout`                  | Server answer deadline or client answer transport deadline.                                                                       | Shorter question or retry later.                                     |
| `incomplete`               | Provider stopped without a complete response, including output-token exhaustion.                                                  | Rephrase/shorten; partial text remains visibly incomplete.           |
| `network`                  | Client connection failed or was interrupted.                                                                                      | Check connectivity and request blocking.                             |
| `protocol`                 | Invalid provider output or client response/session/stream format.                                                                 | Retry; no completed history entry.                                   |
| `unavailable`              | Unclassified upstream/server failure. The exact cause is unknown.                                                                 | Try later or contact the operator; do not invent a cause.            |
| `stopped`                  | Visitor cancelled generation.                                                                                                     | Optional manual retry.                                               |

Storage, clipboard and attachment preparation have separate localized UI messages: blocked/full/expired history, failed copy, unreadable/unsupported/oversized attachment and expired restored attachments. They do not masquerade as an AI billing or service failure. Quota errors never trigger purchases, recharge, provider fallback or automatic retries. Provider and verification mappings follow the [OpenAI error guide](https://developers.openai.com/api/docs/guides/error-codes) and [Turnstile validation contract](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Documented image/prompt failure codes in a Responses terminal event map to `invalid`, including
when the HTTP status is 200. See the [Response error schema](https://developers.openai.com/api/reference/resources/responses/methods/retrieve).
Invalid widget sitekey/domain codes map to `configuration`; iframe load failure remains a
retryable browser challenge, following the [Turnstile client error codes](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
Web-search-specific permissions and outages fall back to indexed sources. Credits, quota and
rate limits still stop further generation calls.

## Runtime protection

The source manifest includes the owner's 43 public repository READMEs discovered on 1 November 2026,
Weather research notes and Music Analyzer. The sitemap supplies the site's public pages. Crawls
advance in batches within the 45-fetch limit, including robots and redirects; changed documents keep
their working index version until a later visit confirms that the replacement completed. With the
current corpus a sweep needs multiple six-hour batches, so both versions can remain searchable
between visits. Search can also briefly return an item after its deletion. New repositories require
a manifest update. Two discovered repositories without a README are described only in the owner-curated catalog.

| Layer            | Mechanism                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bots             | Cloudflare Turnstile before any session is issued                                                                                                                                                                                        |
| Sessions         | HMAC-SHA256 token with expiry, verified without storage; a secret under 32 characters fails closed                                                                                                                                       |
| Abuse and cost   | Per-IP session limits and per-session/shared answer limits, counted per Cloudflare location; rejected sessions do not spend shared quota. A separate enforced provider spend limit is required.                                          |
| Input            | Origin allowlist, body cap counted in bytes (9 MiB for chat, 32 KiB for sessions), at most 12 turns of `user`/`assistant` text, the last one a question; attachments as in the contract above                                            |
| Prompt injection | Source delimiters are escaped, and sources, attachments and history are marked as untrusted data. The model has no privileged mutation tools. Prompt instructions do not guarantee semantic isolation.                                   |
| Web search       | One search per answer at most, `max_tool_calls: 2`, domain filter from `OWNER_PAGES`. Only the query is sent, never the conversation or images. A fact is kept only when every page it cites is an owner page                            |
| Privacy          | The model is told never to give out phone numbers, postal addresses or private email addresses, even when a source holds them. Attachment contents are not stored or logged and never reach AI Search                                    |
| Output           | The browser builds DOM nodes from a Markdown subset, never `innerHTML`; links must be `https`; citations map to server-sent sources only                                                                                                 |
| Errors           | Clients get codes (`busy`, `quota`, `unavailable`), never upstream messages; logs hold timings and token counts, never question text                                                                                                     |
| Crawl            | Every redirect hop stays on listed hosts and respects robots. Reads are bounded; working versions survive pending/failed indexing. Confirmed withdrawals are deleted; uncertain mass omissions are deferred. Hand uploads are untouched. |

## Where the OpenAI key lives

Never in code, in the browser or in a file in this repository. AI deployments use encrypted secrets:

- **GitHub:** a secret of the environment `cloudflare`, which only the `main` branch may use.
  Secrets are not given to workflows triggered by pull requests from forks, and logs mask them.
- **Cloudflare:** an encrypted Worker secret. The `Deploy to Cloudflare` workflow copies it there
  only when `enable_ai` is selected, through `wrangler secret bulk` on stdin. Only server code uses it at runtime.

1. Create a separate OpenAI project for this site. Configure a monthly spend limit with hard
   enforcement and verify recharge settings. Alerts alone do not stop spending; enforcement
   can lag and tracked spending can slightly exceed the limit. See
   [OpenAI spend controls](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform).
2. Create a **restricted** project key with only the Responses permission.
3. Store it without it touching the shell history:
   `gh secret set OPENAI_API_KEY --env cloudflare < key.txt`, then delete `key.txt`.

To rotate: revoke the old key in the OpenAI dashboard, set the new one the same way, run the
workflow. For local development put secrets in `chat/.dev.vars` (ignored by Git; see
`.dev.vars.example`).

## Set up

1. Cloudflare dashboard:
   - AI Search: create namespace `init`, then instance `init` with built-in storage. Keep both
     namespace and instance public endpoints disabled. Set chunks to 384 tokens with 10% overlap,
     to keep retrieved excerpts focused. Reranking is disabled after it filtered known Czech
     and English CV matches; calibrate retrieval on the complete bilingual corpus. Add custom metadata fields
     `url` and `title` (text).
   - Turnstile: add a widget for the site's hostnames. The site key is public, the secret is not.
   - An account-owned API token with `Editor` scoped to the existing `init-chat` Worker.
     No account-wide Workers or zone permissions are needed for this deployment. See
     [Cloudflare Worker permissions](https://developers.cloudflare.com/workers/authorization/workers/).
2. GitHub, environment `cloudflare`:
   - secrets `CLOUDFLARE_API_TOKEN`, `OPENAI_API_KEY`, `TURNSTILE_SECRET` and `SESSION_SECRET`
     (32+ random characters: `openssl rand -base64 48 | gh secret set SESSION_SECRET --env cloudflare`)
   - variables `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_SITE_URL` and `TURNSTILE_SITE_KEY`.
3. In `wrangler.jsonc`, list any other origin that embeds the chat in `ALLOWED_ORIGINS`. The
   Worker's own origin is always allowed.
4. Run the `Deploy to Cloudflare` workflow. It defaults to `wrangler.static.jsonc`, without the
   assistant code or cron and without sending provider secrets. Existing Cloudflare secrets stay
   encrypted because Wrangler preserves them across deployments. Static mode needs only the Cloudflare deployment
   token, account id and canonical site URL. Both modes require CodeQL, audits, types, tests and
   a safe build. Select `enable_ai` only after account spending controls, live retrieval and
   security checks pass; that mode requires the remaining secrets and uses `wrangler.jsonc`.
   AI mode uploads secrets before publishing code. If deployment verification fails, rerun with
   `enable_ai=false` to restore the static site.
5. The cron (minute 17 of every sixth hour) fills the index in bounded batches. The current
   manifest and sitemap need multiple refreshes; incomplete indexing can leave facts unavailable.
6. Optional, the CV: extract public professional content into one Markdown file per PDF page,
   named `owner-cv-page-1.md` and `owner-cv-page-2.md`. Include the original filename and page
   number in each file; omit phone numbers, addresses and private emails. Upload them in the dashboard (AI
   Search, instance `init`, Items) or with a token that has AI Search Edit and Run:

   ```sh
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai-search/namespaces/init/instances/init/items" \
     -H "Authorization: Bearer <API_TOKEN>" -F "file=@owner-cv-page-1.md"
   ```

   Repeat for page 2. No metadata is needed: answers cite the original CV filename and page and show a source excerpt,
   without an unrelated external link (`OWNER_FILES` in `src/sources.ts`). The crawl never deletes it. To update it, delete the item
   in the Items tab and upload the new file. Keep the file out of this repository.
   The legacy single-file key `owner-cv.md` is also accepted; use either it or the paginated
   files, so the same content is not indexed twice.
   Dated owner corrections can be uploaded separately as `owner-updates.md`. These are cited
   as owner updates, so a correction is not attributed to an older PDF that says something else.

Cloudflare is the canonical host. GitHub Pages only redirects legacy links to Cloudflare;
its old full-site deployment workflow remains disabled. The redirect is published from
`fix/legacy-pages-redirect/01-11-2026` and contains no assistant or provider configuration.
Keep the assistant on the same origin; approved public repositories and project pages remain
knowledge sources.

## Costs

Text, images and retrieved context consume model tokens. A searched answer adds a research
request with up to two web-search tool calls, followed by a final answer request. See current
[OpenAI pricing](https://developers.openai.com/api/docs/pricing) and
[Cloudflare AI Search pricing](https://developers.cloudflare.com/ai-search/platform/pricing/).

The rate limits are approximate and per Cloudflare location. They are abuse controls, not a
global spending ceiling. Set and verify the OpenAI project's enforced spend limit before
publishing the assistant, and check the account's recharge and billing settings. Do not infer a
guaranteed answer count from a small text-only benchmark. The crawler separately bounds its
outbound requests with `MAX_FETCHES` in `src/ingest.ts`.

## Change what it knows

Edit `src/sources.ts`:

- `SITEMAPS` are crawled page by page and `DOCUMENTS` are fetched as they are (Markdown, HTML or
  PDF up to 4 MiB). Every redirect hop is checked before fetching and counts toward the request
  budget; robots and sitemap bodies are capped at 512 KiB. A replacement must finish indexing
  before a later visit removes the last working version; failed indexing is retried. Search
  retirement is eventually consistent, so a deleted item can briefly remain in results. Confirmed 404, 410
  and robots withdrawals are removed independently of the partial-crawl deletion guard.
  Previously indexed sitemap pages are rechecked even after omission, so their later removal
  can be confirmed without trusting a shrunken sitemap alone. Redirect targets must also pass
  the owner URL policy, including account paths on shared hosts.
  The sitemap follows the canonical Cloudflare site. Retrieval logs only result count and top
  score, without question or source text; binding failures are reported instead of silently
  appearing as zero matches.
  Query rewriting preserves the latest question's language and meaning, resolving missing references
  from bounded history. Similarity caching is disabled for chat so nearby questions with different
  topics or languages do not reuse the instance's cached search result.
- `OWNER_PAGES` is the fixed list of the owner's profiles and sites that live web search may
  cite, taken from `src/site.ts` and `src/data/projects.yaml`. A test fails when either file
  links somewhere outside it. The Worker never fetches these pages itself; OpenAI's search does.
- `OWNER_FILES` names uploaded documents, cited by filename and a source excerpt. This includes
  sanitized CV pages, a separately dated owner correction, a sourced professional profile and
  an owner-curated public repository inventory. Upload only material approved for public answers:
  retrieved excerpts are visible to visitors before model generation. The model privacy prompt
  is not a substitute for reviewing uploads, and cannot make a private document safe to publish.
  Indexed public pages also send bounded excerpts for evaluation, without rendering or retaining
  those web excerpts in browser history. Approved file excerpts are displayed and retained up to
  1,200 characters; body links survive history.
  The private profile records public source URLs, CV page provenance, research date, conflicting
  dates and unavailable facts. Refresh it when its source facts change; it is not a live feed.

What does not work: the `robots.txt` of LinkedIn, X and Instagram ends with `User-agent: *`,
`Disallow: /` (checked 2026-10-31), so they are not in the crawl lists, and web search finds a
fact there only when OpenAI's search index holds the page. Expect little or nothing from them.

## Check

```sh
npm run check   # generated binding types + TypeScript
npm test        # sessions, input and image limits, prompt isolation, streaming, web evidence, crawl rules
```
