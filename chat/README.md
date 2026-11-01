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

- `images` is optional and allowed on `user` turns only: at most 1 per turn and 3 per request,
  each a `data:image/jpeg|png|webp;base64,` URL of at most 1.5 MiB and 2048 px on the longer
  side. The Worker reads each file header and refuses remote URLs, other types, animated WebP,
  bytes that do not match the declared type and truncated headers. Re-encoding is the browser's
  job. `content` stays a required string, but may be empty when a valid image is attached.
- The body may be up to 5 MiB; text keeps its limits (12 turns, 2,000 characters per question,
  6,000 per answer, 30,000 in total). Text-only requests are unchanged.
- Events: `status` (`{ "stage": "search" }`, then `{ "stage": "web" }` when a web search runs),
  `sources` (sent again with the web results appended; the last list is the complete one),
  `delta`, then `suggestions` (`{ "questions": ["…", "…", "…"] }`) and `done`, or `error`.
  Provider safety refusals may omit suggestions. Citations `[S1]`…`[S10]` refer to the last `sources` list.
- One structured model response streams the answer first and returns zero to three useful follow-up
  questions, without another generation call. Closing replies need no suggestions. Only the latest
  suggestions appear above the composer. The browser inserts at most two authentic project
  screenshots beside relevant cited paragraphs, at their natural aspect ratio.
- The browser keeps up to 10 conversations of 24 text turns each in session storage. The plus
  starts a separate chat; history reopens or deletes threads. Visitors can save individual chats
  on the device for seven days after their last message. At capacity a new chat evicts the oldest
  unsaved thread; saved threads require explicit deletion. Images stay in bounded memory; restored
  turns show that the attachment is unavailable. Interrupted answers are never saved as complete.
- History uses a separate version 3 storage key so older open tabs cannot overwrite saved threads.
  Existing data migrates only when the current key is absent; old keys are retired after successful
  writes. An empty current envelope prevents deleted legacy conversations from returning.
- Browser verification has its own visible state and bounded wait, before retrieval starts.
  Logs record retrieval, first-token, optional web-search and total timing without message text.
- Retrieval sends the latest question separately from up to three earlier text turns in one rewrite
  envelope. History resolves references; it must not replace a new topic. Hybrid keyword matching
  accepts any query term so a paraphrase does not require every word to occur in one document.
- Client cancellation or the 60-second deadline aborts the stream and upstream generation.
  AI Search has no cancellation parameter: the Worker stops awaiting it and does not start an
  answer afterward, but the binding may finish its search in the background.

## What protects it

The source manifest includes the owner's 43 public repository READMEs discovered on 1 November 2026,
Weather research notes and Music Analyzer. The sitemap supplies the site's public pages. Crawls
advance in batches within the 45-fetch limit, including robots and redirects; changed documents keep
their working index version until the replacement completes. New repositories require a manifest
update. Two discovered repositories without a README are described only in the owner-curated catalog.

| Layer            | Mechanism                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bots             | Cloudflare Turnstile before any session is issued                                                                                                                                                                                        |
| Sessions         | HMAC-SHA256 token with expiry, verified without storage; a secret under 32 characters fails closed                                                                                                                                       |
| Abuse and cost   | Per-IP session limits and per-session/shared answer limits, counted per Cloudflare location; rejected sessions do not spend shared quota. A separate enforced provider spend limit is required.                                          |
| Input            | Origin allowlist, body cap counted in bytes (5 MiB for chat, 32 KiB for sessions), at most 12 turns of `user`/`assistant` text, the last one a question; images as in the contract above                                                 |
| Prompt injection | Source delimiters are escaped, and sources, images and history are marked as untrusted data. The model has no privileged mutation tools. Prompt instructions do not guarantee semantic isolation.                                        |
| Web search       | One search per answer at most, `max_tool_calls: 2`, domain filter from `OWNER_PAGES`. Only the query is sent, never the conversation or images. A fact is kept only when every page it cites is an owner page                            |
| Privacy          | The model is told never to give out phone numbers, postal addresses or private email addresses, even when a source holds them. Images are not stored or logged and never reach AI Search                                                 |
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
  before the last working version is removed; failed indexing is retried. Confirmed 404, 410
  and robots withdrawals are removed independently of the partial-crawl deletion guard.
  Previously indexed sitemap pages are rechecked even after omission, so their later removal
  can be confirmed without trusting a shrunken sitemap alone. Redirect targets must also pass
  the owner URL policy, including account paths on shared hosts.
  The sitemap follows the canonical Cloudflare site. Retrieval logs only result count and top
  score, without question or source text; binding failures are reported instead of silently
  appearing as zero matches.
- `OWNER_PAGES` is the fixed list of the owner's profiles and sites that live web search may
  cite, taken from `src/site.ts` and `src/data/projects.yaml`. A test fails when either file
  links somewhere outside it. The Worker never fetches these pages itself; OpenAI's search does.
- `OWNER_FILES` names uploaded documents, cited by filename and a source excerpt. This includes
  sanitized CV pages, a separately dated owner correction, a sourced professional profile and
  an owner-curated public repository inventory. Upload only material approved for public answers:
  retrieved excerpts are visible to visitors before model generation. The model privacy prompt
  is not a substitute for reviewing uploads, and cannot make a private document safe to publish.
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
