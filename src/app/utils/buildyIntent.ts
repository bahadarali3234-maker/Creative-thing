import { isCodeVaultLibraryPrompt, isCreativeThinkLibraryDocument } from './clarificationGate';

/**
 * Determines whether a user prompt is asking to build/create/design a Website or App UI
 * (which must be built in Buildy rather than generated as HTML/CSS/JS inside this workspace).
 *
 * Explicitly allows:
 * - Detailed prompts / prompt writing requests ("write a prompt for...", "give me a Buildy prompt")
 * - Pure non-UI coding tasks in Python, C++, Java, SQL, Go, Rust, Node.js scripts, etc.
 * - Educational explanations, MCQs, and timetables/schedules.
 */
export function isWebsiteOrAppUiBuildRequest(text: string, attachments: any[] = []): boolean {
  const normalized = (text || '').trim();
  if (!normalized && (!attachments || attachments.length === 0)) return false;

  const hasLibraryAttachment =
    Array.isArray(attachments) &&
    attachments.some((a) => {
      const txt =
        a?.codeContent ||
        (typeof a?.preview === 'string' && !a.preview.startsWith('data:') ? a.preview : '') ||
        a?.name ||
        '';
      return isCodeVaultLibraryPrompt(txt) || isCreativeThinkLibraryDocument(txt);
    });

  if (
    hasLibraryAttachment ||
    isCodeVaultLibraryPrompt(normalized) ||
    isCreativeThinkLibraryDocument(normalized)
  ) {
    return true;
  }

  // Allow timetables, routines, and study/workout schedules in-app
  const isTimetable =
    /(\btimetable\b|\btime\s*table\b|\broutine\b|\bdaily\s*routine\b|\bschedule\b|\bday\s*plan\b|\bplanner\b|\bstudy\s*plan\b|\bworkout\s*routine\b|\bworkout\s*plan\b)/i.test(
      normalized
    );
  if (isTimetable) return false;

  // Allow Image Studio & Web Photo Search tasks without redirecting them to Buildy
  const isImageStudioRequest =
    (/\b(png|as\s*png|thumbnail|thumbnails|poster|posters|banner|quote\s*card|insta\s*quote|instagram\s*post|story\s*cover|reel\s*cover|infographic|wordmark|logo(\s*(graphic|type|card|design))?|background\s*(remove|hata|cutout)|remove\s*background|cutout|save\s*template|list\s*templates|custom\s*template)\b/i.test(
      normalized
    ) ||
      /\b(create|make|generate|design|draw|banao|bana\s*do|find|search|show\s*me|dikhao|dhundo)\b.{0,45}\b(image|images|photo|photos|pic|pics|picture|pictures|png|artwork|illustration|graphic|visual|wallpaper|tasveer)\b/i.test(
        normalized
      )) &&
    !/\b(website|web\s*site|landing\s*page|web\s*app|webapp|dashboard\s*ui|mobile\s*app\s*ui)\b/i.test(normalized);
  if (isImageStudioRequest) return false;

  // Allow explicit requests asking only for a prompt, specification, explanation, or non-web programming language
  const isExplicitPromptOnlyRequest =
    /\b(write|give|generate|create|draft|suggest|make)\s+(me\s+)?(a|an|some|the|detailed)?\s*(buildy\s*)?(prompt|prompts|specification|spec|idea|ideas|plan|architecture)\b/i.test(
      normalized
    ) || /\bprompt\s+(for|to\s+build|likh|likho|batao|do)\b/i.test(normalized);
  if (isExplicitPromptOnlyRequest) return false;

  const isNonUiProgrammingLanguage =
    /\b(python|c\+\+|cpp|java\b|c#|csharp|rust|golang|go\s+code|sql|mysql|postgres|bash|shell\s+script|algorithm|data\s+structure|leetcode|pandas|numpy)\b/i.test(
      normalized
    ) && !/\b(website|landing\s*page|web\s*app|web\s*ui|app\s*ui|html\s*site|portfolio\s*site)\b/i.test(normalized);
  if (isNonUiProgrammingLanguage) return false;

  // Match English & Roman Urdu website / landing page / web app / app UI build intent
  const uiTargetRegex =
    /\b(website|web\s*site|landing\s*page|web\s*page|webpage|web\s*app|webapp|app\s*ui|web\s*ui|mobile\s*app\s*ui|ui\s*design|frontend\s*(app|site|page|ui)|portfolio\s*(website|site|page)|ecommerce\s*(website|site)|dashboard\s*ui|html\s*(website|page|site)|single[- ]file\s*(html|website|site))\b/i;

  const buildVerbRegex =
    /\b(create|build|make|design|generate|develop|code|banao|banani|banaye|banayein|bana\s*do|tayyar\s*karo|chahiye)\b/i;

  if (uiTargetRegex.test(normalized) && (buildVerbRegex.test(normalized) || normalized.length < 90)) {
    return true;
  }

  // Also match direct "create/build/make/design an app" when user doesn't specify non-UI CLI/script
  const directAppBuildRegex =
    /\b(create|build|make|design|develop|bana\s*do|banao)\s+(a|an|me\s+a|my)?\s*(new\s*)?(modern\s*|responsive\s*|complete\s*)?(app|web\s*app|ui|interface|homepage|site)\b/i;
  if (directAppBuildRegex.test(normalized)) {
    return true;
  }

  return false;
}
