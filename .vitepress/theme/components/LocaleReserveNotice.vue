<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description: string;
  primaryText: string;
  primaryLink: string;
  secondaryText?: string;
  secondaryLink?: string;
}>();
</script>

<template>
  <section class="locale-reserve">
    <span class="locale-reserve__eyebrow">
      {{ eyebrow ?? "Locale Reserved" }}
    </span>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <div class="locale-reserve__actions">
      <a :href="primaryLink">{{ primaryText }}</a>
      <a v-if="secondaryText && secondaryLink" class="secondary" :href="secondaryLink">
        {{ secondaryText }}
      </a>
    </div>
  </section>
</template>

<style scoped>
.locale-reserve {
  width: min(880px, calc(100vw - 32px));
  padding: 40px;
  margin: 40px auto 0;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
    rgba(12, 14, 18, 0.88);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 36px 100px rgba(0, 0, 0, 0.34);
}

.locale-reserve__eyebrow {
  display: inline-flex;
  padding: 7px 12px;
  margin-bottom: 16px;
  font-family: var(--mse-font-mono);
  font-size: 0.74rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(224, 233, 244, 0.74);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

.locale-reserve h1 {
  margin: 0;
  font-family: var(--mse-font-display);
  font-size: clamp(2.3rem, 5vw, 4rem);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.locale-reserve p {
  max-width: 46rem;
  margin: 14px 0 0;
  color: rgba(224, 233, 244, 0.72);
  font-size: 1.04rem;
  line-height: 1.7;
}

.locale-reserve__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.locale-reserve__actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  font-weight: 600;
  color: #0b0d10;
  text-decoration: none;
  background: linear-gradient(135deg, #f4f6fa, #b8c7dc);
  border-radius: 999px;
}

.locale-reserve__actions a.secondary {
  color: rgba(235, 242, 250, 0.94);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .locale-reserve {
    width: calc(100vw - 24px);
    padding: 28px 20px;
    border-radius: 22px;
  }

  .locale-reserve__actions {
    flex-direction: column;
  }

  .locale-reserve__actions a {
    width: 100%;
  }
}
</style>
