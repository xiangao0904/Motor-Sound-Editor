<script setup lang="ts">
import StyledNumberInput from "@/components/StyledNumberInput.vue";
import { useI18nStore } from "@/stores/i18n";
import { useSettingsStore } from "@/stores/settings";

const emit = defineEmits<{
  close: [];
}>();

const i18n = useI18nStore();
const settingsStore = useSettingsStore();

function updateLanguage(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  settingsStore.setLanguage(value);
}
</script>

<template>
  <div class="modal-backdrop">
    <section class="settings-dialog" role="dialog" aria-modal="true">
      <header>
        <h2>{{ i18n.t("settings.title") }}</h2>
        <button
          type="button"
          :aria-label="i18n.t('app.close')"
          @click="emit('close')"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </header>

      <label>
        <span>{{ i18n.t("settings.language") }}</span>
        <select :value="settingsStore.language" @change="updateLanguage">
          <option
            v-for="languageOption in i18n.availableLanguages"
            :key="languageOption.code"
            :value="languageOption.code"
          >
            {{ languageOption.label }}
          </option>
        </select>
      </label>

      <section class="settings-section">
        <h3>{{ i18n.t("settings.snap") }}</h3>
        <div class="settings-grid">
          <label>
            <span>{{ i18n.t("settings.snapX") }}</span>
            <StyledNumberInput
              :model-value="settingsStore.keyframeSnap.speedStep"
              min="0.01"
              step="0.01"
              :aria-label="i18n.t('settings.snapX')"
              @commit="settingsStore.setKeyframeSnapSpeedStep"
            />
          </label>
          <label>
            <span>{{ i18n.t("settings.snapY") }}</span>
            <StyledNumberInput
              :model-value="settingsStore.keyframeSnap.valueStep"
              min="0.01"
              step="0.01"
              :aria-label="i18n.t('settings.snapY')"
              @commit="settingsStore.setKeyframeSnapValueStep"
            />
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>{{ i18n.t("settings.grid") }}</h3>
        <div class="settings-grid">
          <label>
            <span>{{ i18n.t("settings.gridX") }}</span>
            <StyledNumberInput
              :model-value="settingsStore.grid.xLineCount"
              min="2"
              max="64"
              step="1"
              :aria-label="i18n.t('settings.gridX')"
              @commit="settingsStore.setGridXLineCount"
            />
          </label>
          <label>
            <span>{{ i18n.t("settings.gridPitchY") }}</span>
            <StyledNumberInput
              :model-value="settingsStore.grid.pitchYLineCount"
              min="2"
              max="64"
              step="1"
              :aria-label="i18n.t('settings.gridPitchY')"
              @commit="settingsStore.setGridPitchYLineCount"
            />
          </label>
          <label>
            <span>{{ i18n.t("settings.gridVolumeY") }}</span>
            <StyledNumberInput
              :model-value="settingsStore.grid.volumeYLineCount"
              min="2"
              max="64"
              step="1"
              :aria-label="i18n.t('settings.gridVolumeY')"
              @commit="settingsStore.setGridVolumeYLineCount"
            />
          </label>
        </div>
        <p>{{ i18n.t("settings.linesHint") }}</p>
      </section>

      <footer>
        <button class="primary" type="button" @click="emit('close')">
          {{ i18n.t("app.close") }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(4, 9, 12, 0.58);
  backdrop-filter: blur(6px);
}

.settings-dialog {
  width: min(520px, calc(100vw - 56px));
  padding: 20px;
  color: #f4f8fb;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.settings-dialog header,
.settings-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-dialog header {
  margin-bottom: 18px;
}

.settings-dialog h2,
.settings-dialog h3 {
  margin: 0;
  letter-spacing: 0;
}

.settings-dialog h2 {
  font-size: 22px;
}

.settings-dialog h3 {
  margin-bottom: 12px;
  color: #ffffff;
  font-size: 17px;
}

.settings-dialog header button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.settings-dialog header button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.settings-dialog header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.settings-dialog label {
  display: grid;
  gap: 8px;
  color: rgba(236, 246, 251, 0.78);
  font-size: 14px;
}

.settings-dialog select {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 6px;
  outline: none;
}

.settings-dialog select:focus {
  border-color: rgba(139, 195, 224, 0.62);
}

.settings-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.settings-grid :deep(.styled-number) {
  height: 40px;
}

.settings-section p {
  margin: 10px 0 0;
  color: rgba(236, 246, 251, 0.62);
  font-size: 13px;
}

.settings-dialog footer {
  justify-content: flex-end;
  margin-top: 20px;
}

.settings-dialog footer button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  color: inherit;
  border-radius: 6px;
}

.primary {
  background: #3d6074;
  border: 1px solid rgba(178, 213, 230, 0.18);
}
</style>
