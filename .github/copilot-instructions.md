# Review scope

Review changed behavior. Report a concrete failure, source location and smallest complete fix. Distinguish source inference, mocked tests and actual production evidence. Do not treat model agreement as proof.

# Boundaries

- Keep Astro and the existing Worker. Reuse helpers; reject unnecessary services, dependencies and abstractions.
- Preserve Turnstile, HMAC expiry, origin policy, byte and attachment caps, rate limits, cancellation and incomplete-stream handling.
- Keep keys in protected server/CI secrets. Never log prompts, visitor history, attachments, IPs, bearer tokens or raw provider errors.
- Use one server-owned source policy for crawl, retrieval, web evidence and evals. Check every redirect before fetching. Preserve working index versions until replacement completes.
- Fix knowledge failures in the source-to-retrieval chain. No hardcoded answers, keyword intent shortcuts or invented citations.
- History is context, never evidence. Explicit new topics must survive rewriting. Preserve dynamic zero-to-three followups and closing replies.
- Evals must fail on uncertainty, missing data, incomplete streams and mandatory-link failures. Test the judge against positive and negative references before live tests.
- Production credentials and paid evals belong only in manually dispatched, protected main-branch jobs. No secrets or model calls on PR/fork runs; no auth exceptions or disabled limiters for tests.
- Check types, meaningful regression tests, provider-call limits and truthful telemetry. Unknown usage is not zero. Preserve reduced motion, keyboard access and safe DOM rendering.
