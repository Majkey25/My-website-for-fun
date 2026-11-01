// Secret names are types only; their values are supplied by Cloudflare at runtime.
interface Env {
  OPENAI_API_KEY: string;
  SESSION_SECRET: string;
  TURNSTILE_SECRET: string;
}
