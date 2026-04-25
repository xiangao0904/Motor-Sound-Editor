<script setup lang="ts">
import { computed } from "vue";
import { withBase } from "vitepress";

import LoopingVideo from "./LoopingVideo.vue";
import { homeContent, type HomeLocale } from "./homeContent";

const props = withDefaults(
  defineProps<{
    locale?: HomeLocale;
  }>(),
  {
    locale: "en",
  },
);

const currentVersion = "v1.0.0";
const githubHref = "https://github.com/xiangao0904/Motor-Sound-Editor";
const content = computed(() => homeContent[props.locale]);
const isChinese = computed(() => props.locale === "zh");
const heroTitle = computed(() => content.value.hero.titleLines.join(isChinese.value ? "" : " "));
const logoSrc = withBase("/logo256.png");

function resolveSitePath(path: string) {
  return path.startsWith("/") ? withBase(path) : path;
}
</script>

<template>
  <main class="mse-home" :class="{ 'mse-home--zh': isChinese }">
    <nav class="mse-nav" :aria-label="content.navAriaLabel">
      <a class="mse-brand" href="#top" :aria-label="content.homeAriaLabel">
        <img class="mse-brand__mark" :src="logoSrc" alt="" />
        <span>Motor Sound Editor</span>
      </a>
      <div class="mse-nav__links" :aria-label="content.sectionLinksAriaLabel">
        <a v-for="item in content.navItems" :key="item.label" :href="item.href">{{ item.label }}</a>
      </div>
      <div class="mse-nav__actions">
        <a class="mse-nav__lang" :href="resolveSitePath(content.languageSwitchHref)" :aria-label="content.languageSwitchAriaLabel">
          {{ content.languageSwitchLabel }}
        </a>
        <a class="mse-nav__cta" :href="content.downloadHref">{{ content.downloadLabel }}</a>
      </div>
    </nav>

    <section id="top" class="mse-hero" aria-labelledby="hero-title">
      <div class="mse-hero__backdrop" aria-hidden="true">
        <img class="mse-brand-glow mse-brand-glow--left" :src="logoSrc" alt="" />
        <img class="mse-brand-glow mse-brand-glow--right" :src="logoSrc" alt="" />
        <span class="mse-rail mse-rail--one"></span>
        <span class="mse-rail mse-rail--two"></span>
      </div>

      <div class="mse-shell mse-hero__layout">
        <div class="mse-hero__copy">
          <p class="mse-kicker">{{ content.hero.kicker }}</p>
          <h1 id="hero-title">{{ heroTitle }}</h1>
          <p class="mse-hero__lead">{{ content.hero.lead }}</p>

          <div class="mse-hero__actions">
            <a class="mse-button mse-button--primary" :href="content.downloadHref">
              {{ content.hero.primaryAction }}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            </a>
            <a class="mse-button mse-button--secondary" :href="resolveSitePath(content.docsHref)">{{ content.hero.secondaryAction }}</a>
          </div>

          <p class="mse-version">{{ content.versionLabel }} {{ currentVersion }}</p>

          <dl class="mse-hero__stats" aria-label="Product highlights">
            <div v-for="stat in content.hero.stats" :key="stat.value">
              <dt>{{ stat.value }}</dt>
              <dd>{{ stat.label }}</dd>
            </div>
          </dl>
        </div>

        <div class="mse-hero__showcase" :aria-label="content.showcaseAriaLabel">
          <div class="mse-product-frame">
            <div class="mse-product-frame__topbar">
              <div aria-hidden="true"><span></span><span></span><span></span></div>
              <div class="mse-brand-lockup mse-brand-lockup--frame">
                <img class="mse-brand-lockup__mark" :src="logoSrc" alt="" />
                <span class="mse-brand-lockup__text">
                  <strong>Motor Sound Editor</strong>
                  <small>{{ content.brandSubline }}</small>
                </span>
              </div>
              <em>{{ content.frameContext }}</em>
            </div>
            <div class="mse-media-shell mse-media-shell--hero mse-media-shell--contain">
              <img class="mse-media" :src="resolveSitePath('/editpage2.png')" alt="Motor Sound Editor editor workspace preview" />
            </div>
          </div>

          <div class="mse-floating-card mse-floating-card--left" aria-hidden="true">
            <span>{{ content.hero.floatingLeft.eyebrow }}</span>
            <strong>{{ content.hero.floatingLeft.value }}</strong>
            <small>{{ content.hero.floatingLeft.label }}</small>
          </div>
          <div class="mse-floating-card mse-floating-card--right" aria-hidden="true">
            <span>{{ content.hero.floatingRight.eyebrow }}</span>
            <strong>{{ content.hero.floatingRight.value }}</strong>
            <small>{{ content.hero.floatingRight.label }}</small>
          </div>
        </div>
      </div>
    </section>

    <section id="why" class="mse-section mse-section--why" aria-labelledby="why-title">
      <div class="mse-shell">
        <div class="mse-section__intro mse-section__intro--center">
          <p class="mse-kicker">{{ content.why.kicker }}</p>
          <h2 id="why-title">{{ content.why.title }}</h2>
          <p>{{ content.why.lead }}</p>
        </div>

        <div class="mse-comparison">
          <article v-for="card in content.why.cards" :key="card.title" class="mse-comparison__card" :class="`mse-comparison__card--${card.tone}`">
            <span class="mse-card-label">{{ card.eyebrow }}</span>
            <h3>{{ card.title }}</h3>
            <p>{{ card.copy }}</p>

            <div v-if="card.tone === 'legacy'" class="mse-csv-panel" aria-label="CSV editing mockup">
              <code>0.2,1,0.7,,,,,,,,,,,,,,,,,,,0.2</code>
              <code>2,1,0.7,0.5,0.5,,,,,,,,,,,,,,,,,</code>
              <code>10,1.6,1.3,1,1,1,,,,,,,,,,,,,,,,</code>
              <code>20,1.6,1.3,,,,1.2,,,,,,,,,,,,,,,</code>
            </div>
            <div v-else class="mse-curve-panel" aria-label="Curve editing mockup">
              <svg viewBox="0 0 360 180" role="img">
                <defs>
                  <linearGradient id="mse-curve-fill" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stop-color="currentColor" stop-opacity="0.32" />
                    <stop offset="1" stop-color="currentColor" stop-opacity="0.02" />
                  </linearGradient>
                </defs>
                <path class="mse-curve-panel__grid" d="M34 24v132M112 24v132M190 24v132M268 24v132M326 24v132M24 42h312M24 90h312M24 138h312" />
                <path class="mse-curve-panel__area" d="M28 132 C72 94 100 116 142 78 C184 40 216 58 270 30 C296 18 316 28 332 44 L332 156 L28 156 Z" />
                <path class="mse-curve-panel__line" d="M28 132 C72 94 100 116 142 78 C184 40 216 58 270 30 C296 18 316 28 332 44" />
                <circle cx="28" cy="132" r="5" />
                <circle cx="142" cy="78" r="5" />
                <circle cx="270" cy="30" r="5" />
                <circle cx="332" cy="44" r="5" />
              </svg>
            </div>

            <ul>
              <li v-for="bullet in card.bullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section id="features" class="mse-section mse-section--features" aria-labelledby="features-title">
      <div class="mse-shell">
        <div class="mse-section__intro">
          <p class="mse-kicker">{{ content.features.kicker }}</p>
          <h2 id="features-title">{{ content.features.title }}</h2>
          <p>{{ content.features.lead }}</p>
        </div>
        <div class="mse-feature-grid">
          <article v-for="feature in content.features.items" :key="feature.title" class="mse-feature-card">
            <div class="mse-feature-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path :d="feature.icon" /></svg>
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.copy }}</p>
          </article>
        </div>
      </div>
    </section>

    <section id="showcase" class="mse-section mse-section--showcase" aria-labelledby="showcase-title">
      <div class="mse-shell">
        <div class="mse-section__intro mse-section__intro--center">
          <p class="mse-kicker">{{ content.showcase.kicker }}</p>
          <h2 id="showcase-title">{{ content.showcase.title }}</h2>
          <p>{{ content.showcase.lead }}</p>
        </div>
        <div class="mse-showcase-grid">
          <article v-for="card in content.showcase.cards" :key="card.title" class="mse-showcase-card">
            <div class="mse-showcase-card__header">
              <span class="mse-card-label">{{ card.label }}</span>
              <h3>{{ card.title }}</h3>
              <p>{{ card.copy }}</p>
            </div>
            <div class="mse-media-frame">
              <div class="mse-media-shell mse-media-shell--showcase mse-media-shell--contain">
                <img class="mse-media" :src="resolveSitePath(card.src)" :alt="card.alt" loading="lazy" />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="workflow" class="mse-section mse-section--workflow" aria-labelledby="workflow-title">
      <div class="mse-shell">
        <div class="mse-section__intro mse-section__intro--center">
          <p class="mse-kicker">{{ content.workflow.kicker }}</p>
          <h2 id="workflow-title">{{ content.workflow.title }}</h2>
          <p>{{ content.workflow.lead }}</p>
        </div>
        <div class="mse-workflow-list">
          <article v-for="(step, index) in content.workflow.steps" :key="step.title" class="mse-workflow-item" :class="{ 'mse-workflow-item--reverse': index % 2 === 1 }">
            <div class="mse-workflow-item__visual">
              <div class="mse-media-frame mse-media-frame--workflow">
                <div class="mse-media-shell mse-media-shell--workflow mse-media-shell--contain">
                  <LoopingVideo class="mse-media" :src="resolveSitePath(step.src)" :label="step.label" />
                </div>
              </div>
            </div>
            <div class="mse-workflow-item__copy">
              <span>{{ step.number }}</span>
              <h3>{{ step.title }}</h3>
              <p>{{ step.copy }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="format" class="mse-section mse-section--tech" aria-labelledby="tech-title">
      <div class="mse-shell mse-tech-layout">
        <div class="mse-tech-layout__copy">
          <p class="mse-kicker">{{ content.foundation.kicker }}</p>
          <h2 id="tech-title">{{ content.foundation.title }}</h2>
          <p>{{ content.foundation.lead }}</p>
          <div class="mse-tech-proof-grid" aria-label="Foundation capabilities">
            <article v-for="item in content.foundation.items" :key="item.title" class="mse-tech-proof-card">
              <h3>{{ item.title }}</h3>
              <p>{{ item.copy }}</p>
            </article>
          </div>
        </div>
        <article class="mse-format-card">
          <div class="mse-format-card__header">
            <span>{{ content.foundation.format.badge }}</span>
            <strong>{{ content.foundation.format.eyebrow }}</strong>
          </div>
          <h3>{{ content.foundation.format.title }}</h3>
          <p>{{ content.foundation.format.copy }}</p>
          <div class="mse-format-card__map" aria-hidden="true">
            <span v-for="item in content.foundation.format.map" :key="item">{{ item }}</span>
          </div>
        </article>
      </div>
    </section>

    <section id="docs" class="mse-section mse-section--docs" aria-labelledby="docs-title">
      <div class="mse-shell mse-docs-spotlight">
        <div class="mse-docs-spotlight__intro">
          <p class="mse-kicker">{{ content.docs.kicker }}</p>
          <h2 id="docs-title">{{ content.docs.title }}</h2>
          <p>{{ content.docs.lead }}</p>
          <div style="height: 14px;"/>
          <a class="mse-button mse-button--primary" :href="resolveSitePath(content.docsHref)">{{ content.docs.action }}</a>
        </div>
        <div class="mse-docs-grid">
          <a v-for="card in content.docs.cards" :key="card.title" class="mse-docs-card" :href="resolveSitePath(card.href)">
            <span class="mse-docs-card__eyebrow">Docs</span>
            <h3>{{ card.title }}</h3>
            <p>{{ card.copy }}</p>
            <strong>{{ card.cta }}</strong>
          </a>
        </div>
      </div>
    </section>

    <section class="mse-final-cta" aria-labelledby="final-cta-title">
      <div class="mse-shell mse-final-cta__panel">
        <div>
          <p class="mse-kicker">{{ content.finalCta.kicker }}</p>
          <h2 id="final-cta-title">{{ content.finalCta.title }}</h2>
          <p>{{ content.finalCta.copy }}</p>
        </div>
        <div class="mse-final-cta__actions">
          <a class="mse-button mse-button--primary" :href="content.downloadHref">{{ content.finalCta.primaryAction }}</a>
          <a class="mse-button mse-button--secondary" :href="resolveSitePath(content.docsHref)">{{ content.finalCta.secondaryAction }}</a>
          <a class="mse-button mse-button--secondary" :href="githubHref" target="_blank" rel="noreferrer">{{ content.githubLabel }}</a>
          <div style="text-align: center;">
            <small class="version-small">{{ content.versionLabel }} {{ currentVersion }}</small>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
