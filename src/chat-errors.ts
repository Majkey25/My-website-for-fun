export const CHAT_ERROR_CODES = [
  'busy',
  'credits',
  'quota',
  'configuration',
  'challenge',
  'verification_unavailable',
  'session',
  'invalid',
  'too_large',
  'origin',
  'method',
  'not_found',
  'timeout',
  'incomplete',
  'network',
  'protocol',
  'unavailable',
  'stopped',
] as const;
export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

export const chatErrorCode = (value: unknown): ChatErrorCode =>
  CHAT_ERROR_CODES.find((code) => code === value) ?? 'unavailable';

/** Unknown or non-JSON failures never expose provider text to the visitor. */
export function chatHttpError(status: number, body: unknown): ChatErrorCode {
  const code =
    body && typeof body === 'object' && 'error' in body ? chatErrorCode(body.error) : 'unavailable';
  if (code !== 'unavailable') return code;
  if (status === 401) return 'session';
  if (status === 429) return 'busy';
  if (status === 413) return 'too_large';
  if ([400, 415, 422].includes(status)) return 'invalid';
  if (status === 404) return 'not_found';
  if (status === 405) return 'method';
  return 'unavailable';
}

export const canRetryChatError = (code: ChatErrorCode) =>
  ![
    'credits',
    'quota',
    'configuration',
    'invalid',
    'too_large',
    'origin',
    'method',
    'not_found',
  ].includes(code);

export const chatErrors = {
  cs: {
    busy: 'Asistent teď přijímá příliš mnoho požadavků. Počkejte prosím minutu a zkuste to znovu.',
    credits:
      'Provozovateli AI asistenta došly kredity. Chat teď nemůže odpovídat a opakování otázky nepomůže. Napište mi prosím přes kontakt.',
    quota:
      'AI asistent dosáhl limitu využití nebo rozpočtu provozovatele. Chat teď nemůže odpovídat. Napište mi prosím přes kontakt.',
    configuration:
      'AI asistent nemá správně nastavené připojení nebo přístup k modelu. Opravu musí provést provozovatel. Použijte prosím kontakt.',
    challenge:
      'Kontrola prohlížeče se nenačetla nebo nebyla dokončena. Spusťte ji znovu. Prohlížeč musí povolit načtení challenges.cloudflare.com.',
    verification_unavailable:
      'Služba ověření prohlížeče teď neodpovídá. Počkejte chvíli a zkuste to znovu.',
    session:
      'Ověření chatu vypršelo nebo bylo odmítnuto. Zkuste otázku odeslat znovu a dokončete novou kontrolu prohlížeče.',
    invalid:
      'Zprávu nebo přílohu se nepodařilo zpracovat. Zkuste nový chat s kratším textem nebo jinou podporovanou přílohou.',
    too_large:
      'Zpráva nebo přílohy překračují povolenou velikost. Začněte nový chat s kratším textem nebo menší přílohou.',
    origin: 'Chat není z této adresy povolený. Otevřete web na init-chat.majkeylab.workers.dev.',
    method:
      'Požadavek na chat má nepodporovaný formát. Obnovte stránku. Pokud chyba trvá, napište mi přes kontakt.',
    not_found:
      'Chat na této adrese není dostupný. Obnovte stránku. Pokud chyba trvá, napište mi přes kontakt.',
    timeout: 'Odpověď překročila časový limit. Zkuste otázku zkrátit nebo ji poslat později.',
    incomplete:
      'AI služba odpověď nedokončila. Zobrazená část se neuložila jako hotová odpověď. Zkuste otázku upřesnit nebo zkrátit.',
    network:
      'Spojení s asistentem se přerušilo nebo se nepodařilo navázat. Zkontrolujte připojení a případné blokování požadavků v prohlížeči.',
    protocol:
      'Odpověď dorazila v neplatném nebo neúplném formátu. Neuložila se jako hotová odpověď. Zkuste to znovu.',
    unavailable:
      'AI služba teď odpověď nedodala. Přesnou příčinu nemám potvrzenou. Zkuste to později nebo mi napište přes kontakt.',
    stopped: 'Generování bylo zastaveno. Rozepsaná odpověď se neuložila do historie.',
  },
  en: {
    busy: 'The assistant is receiving too many requests. Please wait a minute and try again.',
    credits:
      'The assistant operator has run out of AI credits. Chat cannot answer right now, and retrying will not restore access. Please use the contact page.',
    quota:
      'The assistant has reached its operator’s usage or spending limit. Chat cannot answer right now. Please use the contact page.',
    configuration:
      'The assistant connection or model access is not configured correctly. The site operator needs to fix it. Please use the contact page.',
    challenge:
      'The browser check did not load or finish. Try starting it again. Your browser must allow challenges.cloudflare.com to load.',
    verification_unavailable:
      'The browser verification service is not responding. Please wait a moment and try again.',
    session:
      'Chat verification expired or was rejected. Send your question again and complete the new browser check.',
    invalid:
      'The message or attachment could not be processed. Start a new chat with shorter text or a different supported attachment.',
    too_large:
      'The message or attachments exceed the size limit. Start a new chat with shorter text or a smaller attachment.',
    origin:
      'Chat is not allowed from this address. Open the site at init-chat.majkeylab.workers.dev.',
    method:
      'The chat request uses an unsupported format. Reload the page. If this continues, please contact me.',
    not_found:
      'Chat is not available at this address. Reload the page. If this continues, please contact me.',
    timeout: 'The answer exceeded the time limit. Try a shorter question or send it later.',
    incomplete:
      'The AI service did not finish its answer. The partial text was not saved as a completed answer. Try a clearer or shorter question.',
    network:
      'The connection to the assistant failed or was interrupted. Check your connection and any browser request blocking.',
    protocol:
      'The answer arrived in an invalid or incomplete format. It was not saved as a completed answer. Please try again.',
    unavailable:
      'The AI service did not return an answer. The exact cause is not confirmed. Try later or use the contact page.',
    stopped: 'Generation stopped. The partial answer was not saved in conversation history.',
  },
} satisfies Record<'cs' | 'en', Record<ChatErrorCode, string>>;
