<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    disabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    step: 1,
    disabled: false,
    placeholder: "",
    ariaLabel: "Number input",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  commit: [value: number];
}>();

const draft = ref(props.modelValue == null ? "" : String(props.modelValue));
const lastCommittedText = ref(draft.value);
const isFocused = ref(false);

const numericMin = computed(() => {
  const value = Number(props.min);
  return Number.isFinite(value) ? value : undefined;
});

const numericMax = computed(() => {
  const value = Number(props.max);
  return Number.isFinite(value) ? value : undefined;
});

const numericStep = computed(() => {
  const value = Number(props.step);
  return Number.isFinite(value) && value > 0 ? value : 1;
});

const decimals = computed(() => {
  const value = String(props.step);
  const [, fraction = ""] = value.split(".");
  return Math.min(fraction.length, 4);
});

watch(
  () => props.modelValue,
  (value) => {
    if (isFocused.value) return;
    draft.value = value == null ? "" : String(value);
    lastCommittedText.value = draft.value;
  },
);

function clampValue(value: number) {
  let next = value;

  if (typeof numericMin.value === "number") {
    next = Math.max(numericMin.value, next);
  }

  if (typeof numericMax.value === "number") {
    next = Math.min(numericMax.value, next);
  }

  return next;
}

function formatValue(value: number) {
  const normalized = Number(value.toFixed(decimals.value));
  return decimals.value > 0
    ? normalized.toFixed(decimals.value)
    : String(normalized);
}

function parsedValue() {
  const value = Number(draft.value);
  return Number.isFinite(value) ? value : null;
}

function setDraft(value: number, shouldCommit = true) {
  const normalized = Number(clampValue(value).toFixed(decimals.value));
  const formatted = formatValue(normalized);
  draft.value = formatted;
  emit("update:modelValue", formatted);
  if (shouldCommit && formatted !== lastCommittedText.value) {
    lastCommittedText.value = formatted;
    emit("commit", normalized);
  }
}

function commitDraft() {
  const value = parsedValue();

  if (value === null) {
    draft.value = props.modelValue == null ? "" : String(props.modelValue);
    return;
  }

  setDraft(value);
}

function stepBy(direction: 1 | -1) {
  if (props.disabled) return;

  const fallback =
    parsedValue() ??
    (typeof numericMin.value === "number" ? numericMin.value : 0);
  setDraft(fallback + numericStep.value * direction);
}

function updateDraft(event: Event) {
  const input = event.target as HTMLInputElement;
  draft.value = input.value;
  emit("update:modelValue", input.value);
}
</script>

<template>
  <div class="styled-number" :class="{ disabled }">
    <input
      :value="draft"
      type="text"
      inputmode="decimal"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="updateDraft"
      @focus="isFocused = true"
      @blur="
        isFocused = false;
        commitDraft();
      "
      @keydown.enter.prevent="commitDraft"
    />
    <div class="stepper" aria-hidden="true">
      <button
        type="button"
        tabindex="-1"
        :disabled="disabled"
        @mousedown.prevent
        @click="stepBy(1)"
      >
        <svg viewBox="0 0 10 10"><path d="M5 2 8 6H2z" /></svg>
      </button>
      <button
        type="button"
        tabindex="-1"
        :disabled="disabled"
        @mousedown.prevent
        @click="stepBy(-1)"
      >
        <svg viewBox="0 0 10 10"><path d="M5 8 2 4h6z" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.styled-number {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  color: #ffffff;
  background: #172129;
  border: 1px solid transparent;
  border-radius: 4px;
}

.styled-number:focus-within {
  border-color: rgba(139, 195, 224, 0.62);
  box-shadow: 0 0 0 3px rgba(90, 136, 160, 0.14);
}

.styled-number.disabled {
  opacity: 0.52;
}

.styled-number input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0 7px;
  color: inherit;
  font: inherit;
  text-align: inherit;
  background: transparent;
  border: 0;
  outline: none;
}

.styled-number input:disabled {
  cursor: default;
}

.stepper {
  display: grid;
  grid-template-rows: 1fr 1fr;
  border-left: 1px solid rgba(178, 213, 230, 0.08);
}

.stepper button {
  display: grid;
  place-items: center;
  width: 22px;
  min-width: 0;
  height: 100%;
  padding: 0;
  color: rgba(232, 244, 250, 0.72);
  background: rgba(255, 255, 255, 0.025);
  border: 0;
}

.stepper button:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(93, 134, 203, 0.28);
}

.stepper button:disabled {
  cursor: default;
}

.stepper svg {
  width: 9px;
  height: 9px;
  fill: currentColor;
}
</style>
