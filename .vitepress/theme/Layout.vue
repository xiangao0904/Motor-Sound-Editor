<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import HomePage from "./components/HomePage.vue";
import LocaleHomePage from "./components/LocaleHomePage.vue";

const route = useRoute();

const isEnglishHome = computed(() => route.path === "/");
const isChineseHome = computed(() => route.path === "/zh/");
</script>

<template>
  <HomePage v-if="isEnglishHome" />
  <LocaleHomePage v-else-if="isChineseHome" />
  <DefaultTheme.Layout v-else />
</template>
