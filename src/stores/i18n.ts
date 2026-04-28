import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import type { AppLanguage } from "@/stores/settings";
import { normalizeLanguageByAvailable } from "@/stores/settings";

type MessageBundle = Partial<Record<AppLanguage, Record<string, string>>>;
interface LanguageOption {
  code: string;
  label: string;
}

const FALLBACK_LANGUAGE: AppLanguage = "en";

function parseLocaleXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return null;

  const locale = document.querySelector("locale");
  const code = locale?.getAttribute("code")?.trim();
  if (!code) return null;

  const entries: Record<string, string> = {};
  locale?.querySelectorAll("text").forEach((textElement) => {
    const key = textElement.getAttribute("key");
    if (!key) return;
    entries[key] = textElement.textContent ?? "";
  });

  const label = entries.language?.trim() || code;
  return { code, label, entries };
}

export const useI18nStore = defineStore("i18n", () => {
  const messages = ref<MessageBundle>({});
  const availableLanguages = ref<LanguageOption[]>([]);
  const isLoaded = ref(false);
  const settingsStore = useSettingsStore();

  const language = computed(() => settingsStore.language);

  async function loadLocales() {
    try {
      const localeModules = import.meta.glob("/src/locales/*.xml", {
        eager: true,
        import: "default",
        query: "?raw",
      }) as Record<string, string>;
      const nextMessages: MessageBundle = {};
      const nextLanguages: LanguageOption[] = [];

      Object.values(localeModules).forEach((xml) => {
        const parsed = parseLocaleXml(xml);
        if (!parsed) return;

        nextMessages[parsed.code] = parsed.entries;
        nextLanguages.push({ code: parsed.code, label: parsed.label });
      });

      messages.value = nextMessages;
      availableLanguages.value = nextLanguages.sort((a, b) =>
        a.code.localeCompare(b.code),
      );
      settingsStore.setLanguage(
        normalizeLanguageByAvailable(
          settingsStore.language,
          availableLanguages.value.map((item) => item.code),
        ),
      );
      isLoaded.value = true;
    } catch (error) {
      console.error("Locale loading failed", error);
      isLoaded.value = true;
    }
  }

  function t(key: string): string {
    return (
      messages.value[language.value]?.[key] ??
      messages.value[FALLBACK_LANGUAGE]?.[key] ??
      messages.value[
        availableLanguages.value[0]?.code as AppLanguage
      ]?.[key] ??
      key
    );
  }

  return {
    isLoaded,
    language,
    availableLanguages,

    loadLocales,
    t,
  };
});
