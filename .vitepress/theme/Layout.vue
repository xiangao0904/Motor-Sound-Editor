<script setup lang="ts">
import { computed } from "vue";
import { useData, useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import HomePage from "./components/HomePage.vue";
import LocaleHomePage from "./components/LocaleHomePage.vue";

const route = useRoute();
const { site } = useData();

const normalizedPath = computed(() => {
  const base = site.value.base === "/" ? "" : site.value.base.replace(/\/$/, "");
  const pathWithoutBase = base && route.path.startsWith(base)
    ? route.path.slice(base.length)
    : route.path;

  if (pathWithoutBase === "") {
    return "/";
  }

  return pathWithoutBase.startsWith("/") ? pathWithoutBase : `/${pathWithoutBase}`;
});

const isEnglishHome = computed(() => normalizedPath.value === "/");
const isChineseHome = computed(() => normalizedPath.value === "/zh/");
</script>

<template>
  <HomePage v-if="isEnglishHome" />
  <LocaleHomePage v-else-if="isChineseHome" />
  <DefaultTheme.Layout v-else />
</template>
