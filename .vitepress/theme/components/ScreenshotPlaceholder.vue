<script setup lang="ts">
defineProps<{
  title: string;
  caption?: string;
  ratio?: string;
  tone?: "dark" | "warm";
}>();
</script>

<template>
  <figure
    class="placeholder"
    :class="tone === 'warm' ? 'placeholder--warm' : 'placeholder--dark'"
    :style="{ aspectRatio: ratio ?? '16 / 10' }"
  >
    <div class="placeholder__chrome">
      <span />
      <span />
      <span />
    </div>
    <div class="placeholder__grid" />
    <div class="placeholder__beam" />
    <div class="placeholder__content">
      <em>Product Frame Placeholder</em>
      <strong>{{ title }}</strong>
      <p>{{ caption ?? "Replace this frame with a polished product screenshot later." }}</p>
    </div>
  </figure>
</template>

<style scoped>
.placeholder {
  position: relative;
  display: grid;
  min-height: 280px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
    #0b0d10;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 36px 90px rgba(0, 0, 0, 0.34);
}

.placeholder--dark::before,
.placeholder--warm::before,
.placeholder::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
}

.placeholder--dark::before {
  background:
    radial-gradient(circle at 18% 20%, rgba(196, 205, 222, 0.16), transparent 28%),
    radial-gradient(circle at 80% 14%, rgba(132, 151, 180, 0.14), transparent 22%);
}

.placeholder--warm::before {
  background:
    radial-gradient(circle at 18% 20%, rgba(255, 216, 183, 0.18), transparent 28%),
    radial-gradient(circle at 80% 14%, rgba(173, 154, 130, 0.16), transparent 24%);
}

.placeholder::after {
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.3) 100%);
}

.placeholder__chrome {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
  display: flex;
  gap: 7px;
}

.placeholder__chrome span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.placeholder__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 34px 34px;
  opacity: 0.4;
}

.placeholder__beam {
  position: absolute;
  inset: -30% auto auto -20%;
  width: 70%;
  height: 180%;
  background: linear-gradient(
    120deg,
    transparent 16%,
    rgba(255, 255, 255, 0.08) 40%,
    transparent 70%
  );
  transform: rotate(8deg);
}

.placeholder__content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  align-content: end;
  padding: 28px;
}

.placeholder__content em {
  width: fit-content;
  padding: 7px 11px;
  font-family: var(--mse-font-mono);
  font-size: 0.72rem;
  font-style: normal;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(224, 233, 244, 0.78);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

.placeholder__content strong {
  font-family: var(--mse-font-display);
  font-size: clamp(1.35rem, 2.2vw, 2.1rem);
  line-height: 1;
  letter-spacing: -0.05em;
  color: #f3f6fb;
}

.placeholder__content p {
  max-width: 34ch;
  margin: 0;
  color: rgba(224, 233, 244, 0.72);
  line-height: 1.6;
}
</style>
