import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useI18nStore } from "@/stores/i18n";

if (/Macintosh|Mac OS X/u.test(navigator.userAgent)) {
  document.documentElement.dataset.platform = "macos";
}

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
void useI18nStore(pinia).loadLocales();
app.mount("#app");
