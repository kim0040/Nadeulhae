/**
 * Locale/translation registry for the Nadeulhae app.
 *
 * ## How to add a new language
 * 1. Create a new file `src/data/locales/XX.ts` where `XX` is the two-letter
 *    ISO 639-1 language code (e.g., `fr.ts` for French).
 * 2. Export a default object with all the same keys as `ko.ts`:
 *    ```ts
 *    export const fr = {
 *      // Navbar
 *      nav_home: "Accueil",
 *      nav_jeonju: "Jeonju+",
 *      // ... all ~420 keys ...
 *    }
 *    ```
 *    `ko.ts` is the reference file — every key present there MUST exist in
 *    every other locale file. Missing keys will fall back to the Korean value.
 * 3. Import and register the new locale in this file:
 *    ```ts
 *    import { fr } from "./fr"
 *    // ...
 *    export type Language = "ko" | "en" | "zh" | "ja" | "fr"
 *    // ...
 *    export const translations = { ko, en, zh, ja, fr }
 *    ```
 * 4. Update `LanguageContext.tsx` language auto-detection logic to recognise
 *    the new browser language prefix.
 * 5. Update the navbar language toggle button to include the new option.
 *
 * ## Translation value types
 * - `string` — a single translation for the key.
 * - `string[]` — an array of variant translations. The runtime randomly
 *   selects one using a date+key based seed, giving variety to greeting
 *   and status messages.
 *
 * ## Fallback behaviour
 * The `t()` function in `LanguageContext.tsx` resolves keys as:
 * `translations[language]?.[key] ?? translations.ko?.[key] ?? key`
 * Korean is the ultimate fallback; if Korean is also missing, the raw key
 * string is returned (which will be visible in the UI as a bug signal).
 */
import { ko } from "./ko"
import { en } from "./en"
import { zh } from "./zh"
import { ja } from "./ja"

export type Language = "ko" | "en" | "zh" | "ja"

export const translations: Record<Language, Record<string, string | string[]>> = {
  ko,
  en,
  zh,
  ja,
}
