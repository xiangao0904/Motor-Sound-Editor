import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import LocaleReserveNotice from "./components/LocaleReserveNotice.vue";
import ScreenshotPlaceholder from "./components/ScreenshotPlaceholder.vue";
import "./home.css";
import "./style.css";

const theme = {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("LocaleReserveNotice", LocaleReserveNotice);
    app.component("ScreenshotPlaceholder", ScreenshotPlaceholder);
  },
} as Theme;

export default theme;
