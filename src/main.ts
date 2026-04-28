import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { useI18nStore } from "@/stores/i18n";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
void useI18nStore(pinia).loadLocales();
app.mount("#app");
