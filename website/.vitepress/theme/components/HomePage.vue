<script setup lang="ts">
import LoopingVideo from "./LoopingVideo.vue";

const currentVersion = "v1.0.0";
const downloadHref = "https://github.com/xiangao0904/Motor-Sound-Editor/releases";
const githubHref = "https://github.com/xiangao0904/Motor-Sound-Editor";
const docsHref = "/docs/";

const navItems = [
  { label: "Why", href: "#why" },
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "Workflow", href: "#workflow" },
  { label: "Docs", href: "#docs" },
];

const comparisonCards = [
  {
    eyebrow: "Legacy workflow",
    title: "CSV rows, scattered folders, slow feedback loops.",
    copy: "Traditional motor sound work forces creators to maintain pitch tables, volume tables, file names and test runs separately. Small changes become repetitive, fragile and hard to evaluate.",
    tone: "legacy",
    bullets: ["Manual CSV editing", "Fragmented audio assets", "Delayed in-game validation"],
  },
  {
    eyebrow: "Motor Sound Editor",
    title: "Curves, tracks and preview live in one focused workspace.",
    copy: "Shape speed-based pitch and volume visually, switch train states instantly, and hear the result before packaging the project through one clean native export workflow.",
    tone: "modern",
    bullets: ["Visual curve authoring", "Traction / coast / brake preview", "Native export workflow"],
  },
];

const features = [
  {
    icon: "M4 18C7.5 8.8 10.5 20 14 11.5C16 6.5 18.5 5.6 21 7.2M5 18h16M4 4.5v15",
    title: "Visual curve editing",
    copy: "Edit speed-based pitch and volume curves directly. Add, move and refine keyframes without touching raw CSV tables.",
  },
  {
    icon: "M4 12h3l2.2-5 4.6 11 3-7H21M5 20h14M5 4h14",
    title: "Multi-track live preview",
    copy: "Audition layered motor tracks across traction, coast and braking states while changing speed in real time.",
  },
  {
    icon: "M13 2 4.5 13h7L9 22l10.5-13h-7L13 2Z",
    title: "Native desktop performance",
    copy: "Built with Rust and Tauri for a fast, lightweight desktop experience that stays responsive during detailed sound design.",
  },
  {
    icon: "M12 3v12m0 0 5-5m-5 5-5-5M4 20h16M6 6h4M14 6h4",
    title: "Structured export pipeline",
    copy: "Package projects through a clean native export workflow so handoff, validation and release builds stay organized.",
  },
];

const showcaseCards = [
  {
    label: "Project gallery",
    title: "Home gallery and project management",
    copy: "Browse recent projects, search quickly, sort your work, and jump into a saved sound set without rebuilding context.",
    src: "/homepage.png",
    alt: "Motor Sound Editor home gallery and project management view",
    fit: "contain",
  },
  {
    label: "Editor workspace",
    title: "Curve editing, transport and layered track control",
    copy: "Tune pitch and volume curves against speed, move across train states, and manage track layers inside one dedicated workspace.",
    src: "/editpage.png",
    alt: "Motor Sound Editor editor workspace with curve panels and track layers",
    fit: "contain",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Create or reopen a project",
    copy: "Start from a clean project, reopen an existing .msep workspace, and keep source material inside one organized production context.",
    src: "/createfile.mp4",
  },
  {
    number: "02",
    title: "Sculpt behavior curves",
    copy: "Treat motor sound like a visual system. Add keyframes, reshape transitions, and tune how pitch and volume respond to speed.",
    src: "/sculpt.mp4",
  },
  {
    number: "03",
    title: "Validate while tuning",
    copy: "Preview traction, coasting and braking behavior immediately so each adjustment can be judged in motion instead of waiting for the final package.",
    src: "/validate.mp4",
  },
  {
    number: "04",
    title: "Package for delivery",
    copy: "Build an export-ready package with project structure and bundled assets prepared for testing, release work and sharing.",
    src: "/export.mp4",
  },
];

const docsCards = [
  {
    title: "Quick Start",
    copy: "Install the app, open your first project, and understand the fastest route from source audio to a working package.",
    href: "/docs/guide/getting-started",
  },
  {
    title: "Editor Workflow",
    copy: "Learn how track layers, state previews, curve panels and keyframe editing work together inside the main editor.",
    href: "/docs/guide/editor",
  },
  {
    title: "Export Reference",
    copy: "Review the native export workflow, packaging expectations, and the practical checks to make before a release build.",
    href: "/docs/guide/export",
  },
];

const foundationItems = [
  {
    title: "Visual curve authoring",
    copy: "Edit pitch and volume behavior directly in a visual workspace instead of maintaining raw table files by hand.",
  },
  {
    title: "Portable project container",
    copy: "Keep project data, track layers, curve data and bundled audio together inside one transportable .msep file.",
  },
  {
    title: "Native desktop workflow",
    copy: "Run a fast Rust + Tauri toolchain with layered preview, responsive editing and export-ready project packaging.",
  },
];
</script>

<template>
  <main class="mse-home">
    <nav class="mse-nav" aria-label="Primary navigation">
      <a class="mse-brand" href="#top" aria-label="Motor Sound Editor home">
        <img class="mse-brand__mark" src="/logo256.png" alt="">
        <span>Motor Sound Editor</span>
      </a>
      <div class="mse-nav__links" aria-label="Page sections">
        <a v-for="item in navItems" :key="item.label" :href="item.href">{{ item.label }}</a>
      </div>
      <a class="mse-nav__cta" :href="downloadHref" target="_blank" rel="noreferrer">Download</a>
    </nav>

    <section id="top" class="mse-hero" aria-labelledby="hero-title">
      <div class="mse-hero__backdrop" aria-hidden="true">
        <img class="mse-brand-glow mse-brand-glow--left" src="/logo256.png" alt="">
        <img class="mse-brand-glow mse-brand-glow--right" src="/logo256.png" alt="">
        <span class="mse-rail mse-rail--one"></span>
        <span class="mse-rail mse-rail--two"></span>
      </div>

      <div class="mse-shell mse-hero__layout">
        <div class="mse-hero__copy">
          <p class="mse-kicker">BVE motor sound authoring - visual desktop workflow</p>
          <h1 id="hero-title">
            Design BVE motor sound
            <span>with surgical control.</span>
          </h1>
          <p class="mse-hero__lead">
            Leave manual CSV editing behind. Motor Sound Editor turns pitch, volume, speed and train-state behavior into a refined visual workflow with real-time feedback.
          </p>

          <div class="mse-hero__actions">
            <a class="mse-button mse-button--primary" :href="downloadHref" target="_blank" rel="noreferrer">
              Download for Windows
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            </a>
            <a class="mse-button mse-button--secondary" :href="docsHref">Open Docs</a>
          </div>
          <p class="mse-version">Current release {{ currentVersion }}</p>

          <dl class="mse-hero__stats" aria-label="Product highlights">
            <div>
              <dt>3</dt>
              <dd>drive states with real-time preview</dd>
            </div>
            <div>
              <dt>.msep</dt>
              <dd>portable project format</dd>
            </div>
            <div>
              <dt>Native</dt>
              <dd>Rust + Tauri core</dd>
            </div>
          </dl>
        </div>

        <div class="mse-hero__showcase" aria-label="Software interface preview">
          <div class="mse-product-frame">
            <div class="mse-product-frame__topbar">
              <div aria-hidden="true"><span></span><span></span><span></span></div>
              <div class="mse-brand-lockup mse-brand-lockup--frame">
                <img class="mse-brand-lockup__mark" src="/logo256.png" alt="">
                <span class="mse-brand-lockup__text">
                  <strong>Motor Sound Editor</strong>
                  <small>Desktop authoring suite</small>
                </span>
              </div>
              <em>Curve workspace</em>
            </div>
            <div class="mse-media-shell mse-media-shell--hero mse-media-shell--contain">
              <img class="mse-media" src="/editpage2.png" alt="Motor Sound Editor editor workspace preview" />
            </div>
          </div>

          <div class="mse-floating-card mse-floating-card--left" aria-hidden="true">
            <span>Speed</span>
            <strong>72 km/h</strong>
            <small>live preview</small>
          </div>
          <div class="mse-floating-card mse-floating-card--right" aria-hidden="true">
            <span>State</span>
            <strong>Traction</strong>
            <small>multi-track blend</small>
          </div>
        </div>
      </div>
    </section>

    <section id="why" class="mse-section mse-section--why" aria-labelledby="why-title">
      <div class="mse-shell">
        <div class="mse-section__intro mse-section__intro--center">
          <p class="mse-kicker">Why it exists</p>
          <h2 id="why-title">Spend less time managing files. Spend more time shaping sound.</h2>
          <p>
            BVE motor sound production is detail-heavy, but the creative process should not be buried under spreadsheets, directory conventions and repeated test exports.
          </p>
        </div>

        <div class="mse-comparison">
          <article
            v-for="card in comparisonCards"
            :key="card.title"
            class="mse-comparison__card"
            :class="`mse-comparison__card--${card.tone}`"
          >
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
          <p class="mse-kicker">Core features</p>
          <h2 id="features-title">A focused toolchain for simulator-grade motor sound.</h2>
          <p>
            Built around the decisions that matter most: how the motor evolves with speed, how tracks layer together, and how cleanly the finished package reaches the simulator.
          </p>
        </div>

        <div class="mse-feature-grid">
          <article v-for="feature in features" :key="feature.title" class="mse-feature-card">
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
          <p class="mse-kicker">Product showcase</p>
          <h2 id="showcase-title">The product surface stays as polished as the sound work inside it.</h2>
          <p>
            Manage projects on the home screen, then move into a full editor designed around curve visibility, track layering and state-based playback.
          </p>
        </div>

        <div class="mse-showcase-grid">
          <article v-for="card in showcaseCards" :key="card.title" class="mse-showcase-card">
            <div class="mse-showcase-card__header">
              <span class="mse-card-label">{{ card.label }}</span>
              <h3>{{ card.title }}</h3>
              <p>{{ card.copy }}</p>
            </div>
            <div class="mse-media-frame">
              <div class="mse-media-shell mse-media-shell--showcase mse-media-shell--contain">
                <img class="mse-media" :src="card.src" :alt="card.alt" loading="lazy" />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="workflow" class="mse-section mse-section--workflow" aria-labelledby="workflow-title">
      <div class="mse-shell">
        <div class="mse-section__intro mse-section__intro--center">
          <p class="mse-kicker">Workflow</p>
          <h2 id="workflow-title">From raw samples to a deliverable package.</h2>
          <p>
            A linear, creator-friendly process designed to keep sound decisions visible from project setup to final ZIP export.
          </p>
        </div>

        <div class="mse-workflow-list">
          <article
            v-for="(step, index) in workflowSteps"
            :key="step.title"
            class="mse-workflow-item"
            :class="{ 'mse-workflow-item--reverse': index % 2 === 1 }"
          >
            <div class="mse-workflow-item__visual">
              <div class="mse-media-frame mse-media-frame--workflow">
                <div class="mse-media-shell mse-media-shell--workflow mse-media-shell--contain">
                  <LoopingVideo class="mse-media" :src="step.src" :label="`${step.title} workflow preview`" />
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
          <p class="mse-kicker">Tech stack & format</p>
          <h2 id="tech-title">A native foundation for serious project work.</h2>
          <p>
            Motor Sound Editor pairs a responsive Rust + Tauri desktop shell with a project format built for editing continuity, bundled media and clean native export packaging.
          </p>
          <div class="mse-tech-proof-grid" aria-label="Foundation capabilities">
            <article v-for="item in foundationItems" :key="item.title" class="mse-tech-proof-card">
              <h3>{{ item.title }}</h3>
              <p>{{ item.copy }}</p>
            </article>
          </div>
        </div>

        <article class="mse-format-card">
          <div class="mse-format-card__header">
            <span>.msep</span>
            <strong>Project container</strong>
          </div>
          <h3>Keep project data, curve data, track layers and bundled audio together.</h3>
          <p>
            The dedicated .msep format packages project data and bundled audio so a sound set can be saved, transferred, archived or shared without relying on loose folders or manual file memory.
          </p>
          <div class="mse-format-card__map" aria-hidden="true">
            <span>project data</span>
            <span>curve data</span>
            <span>track layers</span>
            <span>bundled audio</span>
            <span>export output</span>
          </div>
        </article>
      </div>
    </section>

    <section id="docs" class="mse-section mse-section--docs" aria-labelledby="docs-title">
      <div class="mse-shell mse-docs-spotlight">
        <div class="mse-docs-spotlight__intro">
          <p class="mse-kicker">Learn the workflow</p>
          <h2 id="docs-title">Documentation is part of the product, not an afterthought.</h2>
          <p>
            Jump into the docs hub for setup guidance, project management, editor behavior, export workflow notes and answers to the questions that come up during real production work.
          </p>
          <a class="mse-button mse-button--primary" :href="docsHref">Open Docs</a>
        </div>

        <div class="mse-docs-grid">
          <a v-for="card in docsCards" :key="card.title" class="mse-docs-card" :href="card.href">
            <span class="mse-docs-card__eyebrow">Docs</span>
            <h3>{{ card.title }}</h3>
            <p>{{ card.copy }}</p>
            <strong>Read guide</strong>
          </a>
        </div>
      </div>
    </section>

    <section class="mse-final-cta" aria-labelledby="final-cta-title">
      <div class="mse-shell mse-final-cta__panel">
        <div>
          <p class="mse-kicker">Start building</p>
          <h2 id="final-cta-title">Bring a modern authoring workflow to your next BVE motor sound project.</h2>
          <p>Download the Windows release, open the docs, or visit the GitHub repository to follow development and review the source.</p>
        </div>
        <div class="mse-final-cta__actions">
          <a class="mse-button mse-button--primary" :href="downloadHref" target="_blank" rel="noreferrer">Download for Windows</a>
          <a class="mse-button mse-button--secondary" :href="docsHref">Open Docs</a>
          <a class="mse-button mse-button--secondary" :href="githubHref" target="_blank" rel="noreferrer">GitHub Repository</a>
          <small>Current release {{ currentVersion }}</small>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.mse-home {
  --mse-bg: #050711;
  --mse-border: rgba(255, 255, 255, 0.14);
  --mse-text: #f7f8ff;
  --mse-muted: rgba(231, 236, 255, 0.72);
  --mse-dim: rgba(231, 236, 255, 0.5);
  --mse-accent: #8bdcff;
  --mse-radius-xl: 34px;
  --mse-radius-lg: 26px;
  position: relative;
  overflow: clip;
  min-height: 100vh;
  color: var(--mse-text);
  background:
    linear-gradient(180deg, var(--mse-bg), #070a14 44%, var(--mse-bg));
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.mse-home :where(*) {
  box-sizing: border-box;
}

.mse-home :where(a) {
  color: inherit;
}

.mse-shell {
  width: min(1280px, calc(100% - 40px));
  margin: 0 auto;
}

.mse-nav {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 20;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 28px;
  width: min(1280px, calc(100% - 40px));
  min-height: 64px;
  padding: 10px 12px 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(6, 9, 18, 0.68);
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(24px);
  transform: translateX(-50%);
}

.mse-brand,
.mse-nav__links,
.mse-nav__cta {
  display: inline-flex;
  align-items: center;
}

.mse-brand {
  gap: 10px;
  min-width: max-content;
  font-size: 14px;
  font-weight: 850;
  letter-spacing: -0.01em;
  text-decoration: none;
}

.mse-brand__mark {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.mse-nav__links {
  justify-content: center;
  gap: 22px;
}

.mse-nav__links a {
  color: rgba(247, 248, 255, 0.68);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: color 160ms ease;
}

.mse-nav__links a:hover {
  color: var(--mse-text);
}

.mse-nav__cta,
.mse-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.mse-nav__cta {
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  color: #07101b;
  background: #f7f8ff;
  font-size: 13px;
  font-weight: 850;
}

.mse-hero {
  position: relative;
  min-height: 100vh;
  padding: 148px 0 106px;
  isolation: isolate;
}

.mse-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -3;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.95), transparent 78%);
}

.mse-hero__backdrop {
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
}

.mse-brand-glow,
.mse-rail {
  position: absolute;
  display: block;
}

.mse-brand-glow {
  opacity: 0.2;
  filter: blur(74px);
  transform: scale(1.85);
  transform-origin: center;
  user-select: none;
}

.mse-brand-glow--left {
  top: 9%;
  left: -72px;
  width: 220px;
}

.mse-brand-glow--right {
  top: 8%;
  right: -84px;
  width: 250px;
}

.mse-rail {
  width: 680px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.24), transparent);
  transform: rotate(-28deg);
}

.mse-rail--one {
  top: 24%;
  right: 2%;
}

.mse-rail--two {
  right: 16%;
  bottom: 18%;
  opacity: 0.7;
}

.mse-hero__layout {
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(560px, 1.22fr);
  align-items: center;
  gap: clamp(26px, 4.8vw, 64px);
}

.mse-hero__copy {
  display: grid;
  align-content: start;
  max-width: 620px;
}

.mse-kicker {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  max-width: 540px;
  margin: 0 0 18px;
  color: var(--mse-accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  line-height: 1.5;
  text-transform: uppercase;
}

.mse-kicker::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 20px currentColor;
}

.mse-hero h1,
.mse-section h2,
.mse-final-cta h2 {
  margin: 0;
  font-weight: 950;
  letter-spacing: -0.068em;
  line-height: 0.95;
}

.mse-hero h1 {
  max-width: 12ch;
  line-height: 1.02;
  font-size: clamp(42px, 4.3vw, 70px);
  text-wrap: balance;
}

.mse-hero h1 span {
  display: block;
  color: rgba(247, 248, 255, 0.92);
  text-shadow: 0 8px 30px rgba(139, 220, 255, 0.18);
}

.mse-hero__lead {
  margin: 24px 0 0;
  max-width: 34ch;
  color: rgba(231, 236, 255, 0.84);
  font-size: clamp(17px, 1.5vw, 20px);
  line-height: 1.64;
}

.mse-hero__actions,
.mse-final-cta__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.mse-hero__actions {
  margin-top: 30px;
}

.mse-button {
  gap: 10px;
  min-height: 54px;
  padding: 0 24px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-weight: 900;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.mse-button:hover {
  transform: translateY(-2px);
}

.mse-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mse-button--primary {
  color: #07101b;
  background: linear-gradient(135deg, #ffffff, #bfefff 42%, #c9bbff);
  box-shadow: 0 20px 52px rgba(139, 220, 255, 0.24);
}

.mse-button--secondary {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.075);
  backdrop-filter: blur(18px);
}

.mse-button--secondary:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.12);
}

.mse-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 30px 0 0;
}

.mse-hero__stats div {
  min-height: 94px;
  padding: 14px 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(14px);
}

.mse-hero__stats dd,
.mse-version {
  color: var(--mse-dim);
  font-size: 13px;
}

.mse-hero__stats dt {
  margin: 0;
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.05em;
}

.mse-hero__stats dd {
  margin: 6px 0 0;
  line-height: 1.4;
}

.mse-version {
  margin: 12px 0 0 2px;
  letter-spacing: 0.02em;
}

.mse-hero__showcase {
  position: relative;
  min-width: 0;
  perspective: 1200px;
}

.mse-hero__showcase .mse-product-frame {
  width: min(100%, 1220px);
  margin-left: auto;
}

.mse-product-frame,
.mse-media-frame {
  position: relative;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 36px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05)),
    rgba(4, 8, 17, 0.68);
  box-shadow:
    0 42px 120px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(26px);
}

.mse-product-frame {
  transform: rotateX(2deg) rotateY(-5deg);
}

.mse-product-frame::before,
.mse-media-frame::before {
  content: "";
  position: absolute;
  inset: 34px -26px -22px 28px;
  z-index: -1;
  border-radius: 42px;
  background: linear-gradient(135deg, rgba(139, 220, 255, 0.18), rgba(187, 167, 255, 0.15));
  filter: blur(22px);
}

.mse-product-frame__topbar {
  display: grid;
  grid-template-columns: 84px 1fr auto;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 0 16px;
  color: rgba(247, 248, 255, 0.66);
  font-size: 12px;
}

.mse-product-frame__topbar > div:first-child {
  display: flex;
  gap: 8px;
}

.mse-product-frame__topbar > div:first-child span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
}

.mse-product-frame__topbar em {
  color: rgba(247, 248, 255, 0.44);
  font-style: normal;
}

.mse-brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mse-brand-lockup__mark {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.mse-brand-lockup__text {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.mse-brand-lockup__text strong {
  color: rgba(247, 248, 255, 0.82);
  font-size: 13px;
  font-weight: 820;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.mse-brand-lockup__text small {
  color: rgba(247, 248, 255, 0.42);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.1;
  text-transform: uppercase;
}

.mse-media-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 26px;
  aspect-ratio: var(--mse-media-ratio, 1722 / 962);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
    rgba(7, 11, 20, 0.92);
}

.mse-media-shell--hero {
  --mse-media-ratio: 1482 / 1014;
}

.mse-media-shell--contain .mse-media {
  object-fit: contain;
}

.mse-media-shell--cover .mse-media {
  object-fit: cover;
}

.mse-media {
  display: block;
  width: 100%;
  height: 100%;
  background: #050711;
}

.mse-floating-card {
  position: absolute;
  z-index: 3;
  display: grid;
  gap: 4px;
  min-width: 148px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background: rgba(9, 13, 24, 0.72);
  box-shadow: 0 18px 52px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(22px);
}

.mse-floating-card--left {
  left: clamp(-68px, -4.1vw, -20px);
  bottom: clamp(20px, 3.6vw, 48px);
}

.mse-floating-card--right {
  top: clamp(34px, 5.8vw, 72px);
  right: clamp(-14px, -1vw, 6px);
}

.mse-floating-card span,
.mse-floating-card small {
  color: var(--mse-dim);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.mse-floating-card strong {
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -0.04em;
}

.mse-section {
  position: relative;
  padding: 118px 0;
}

.mse-section--why,
.mse-section--workflow,
.mse-section--docs {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)),
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.04), transparent 36rem);
}

.mse-section__intro {
  max-width: 790px;
  margin-bottom: 42px;
}

.mse-section__intro--center {
  margin-right: auto;
  margin-left: auto;
  text-align: center;
}

.mse-section__intro--center .mse-kicker {
  justify-content: center;
}

.mse-section h2,
.mse-final-cta h2 {
  font-size: clamp(38px, 5.5vw, 72px);
}

.mse-section__intro p:not(.mse-kicker),
.mse-tech-layout__copy > p:not(.mse-kicker),
.mse-final-cta p,
.mse-comparison__card p,
.mse-feature-card p,
.mse-workflow-item__copy p,
.mse-format-card p,
.mse-showcase-card p,
.mse-docs-spotlight__intro p:not(.mse-kicker),
.mse-docs-card p {
  color: var(--mse-muted);
  line-height: 1.78;
}

.mse-section__intro p:not(.mse-kicker),
.mse-tech-layout__copy > p:not(.mse-kicker),
.mse-final-cta p,
.mse-docs-spotlight__intro p:not(.mse-kicker) {
  margin: 22px 0 0;
  font-size: 17px;
}

.mse-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
}

.mse-comparison__card,
.mse-feature-card,
.mse-workflow-item__copy,
.mse-format-card,
.mse-final-cta__panel,
.mse-showcase-card,
.mse-docs-card,
.mse-docs-spotlight {
  border: 1px solid var(--mse-border);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.045)),
    rgba(255, 255, 255, 0.045);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(22px);
}

.mse-comparison__card {
  display: grid;
  gap: 18px;
  min-height: 650px;
  padding: clamp(24px, 4vw, 36px);
  border-radius: var(--mse-radius-xl);
}

.mse-comparison__card--modern {
  border-color: rgba(139, 220, 255, 0.34);
  background:
    radial-gradient(circle at 78% 10%, rgba(139, 220, 255, 0.16), transparent 36%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.052));
}

.mse-card-label,
.mse-workflow-item__copy > span {
  width: max-content;
  padding: 6px 11px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(222, 232, 244, 0.78);
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
  font-weight: 820;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mse-comparison__card--legacy .mse-card-label {
  color: rgba(247, 248, 255, 0.58);
  background: rgba(255, 255, 255, 0.06);
}

.mse-comparison__card h3,
.mse-feature-card h3,
.mse-workflow-item__copy h3,
.mse-format-card h3,
.mse-showcase-card h3,
.mse-docs-card h3 {
  margin: 0;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.mse-csv-panel,
.mse-curve-panel {
  align-self: stretch;
  display: grid;
  min-height: 230px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 24px;
  background: rgba(4, 8, 17, 0.58);
}

.mse-csv-panel {
  align-content: center;
  gap: 10px;
  padding: 22px;
}

.mse-csv-panel code {
  display: block;
  padding: 12px 13px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  color: rgba(247, 248, 255, 0.55);
  background: rgba(255, 255, 255, 0.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.mse-curve-panel {
  place-items: center;
  padding: 20px;
  color: var(--mse-accent);
}

.mse-curve-panel svg {
  width: 100%;
  max-width: 390px;
  overflow: visible;
}

.mse-curve-panel__grid {
  fill: none;
  stroke: rgba(255, 255, 255, 0.09);
  stroke-width: 1;
}

.mse-curve-panel__area {
  fill: url(#mse-curve-fill);
}

.mse-curve-panel__line {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 6;
}

.mse-curve-panel circle {
  fill: #070b14;
  stroke: currentColor;
  stroke-width: 4;
}

.mse-comparison__card ul {
  display: grid;
  gap: 11px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mse-comparison__card li {
  position: relative;
  padding-left: 25px;
  color: rgba(247, 248, 255, 0.76);
  line-height: 1.5;
}

.mse-comparison__card li::before {
  content: "";
  position: absolute;
  top: 0.62em;
  left: 0;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.78;
}

.mse-feature-grid,
.mse-showcase-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.mse-feature-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.mse-feature-card,
.mse-showcase-card,
.mse-docs-card {
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.mse-feature-card {
  min-height: 348px;
  padding: 28px;
  border-radius: var(--mse-radius-lg);
}

.mse-showcase-card {
  display: grid;
  gap: 22px;
  padding: 28px;
  border-radius: var(--mse-radius-xl);
}

.mse-showcase-card__header {
  display: grid;
  gap: 14px;
}

.mse-feature-card:hover,
.mse-showcase-card:hover,
.mse-docs-card:hover {
  transform: translateY(-5px);
  border-color: rgba(139, 220, 255, 0.34);
  background:
    radial-gradient(circle at 50% 0%, rgba(139, 220, 255, 0.12), transparent 58%),
    rgba(255, 255, 255, 0.08);
}

.mse-feature-card__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 30px;
  border: 1px solid rgba(139, 220, 255, 0.34);
  border-radius: 19px;
  color: var(--mse-accent);
  background: rgba(139, 220, 255, 0.09);
}

.mse-feature-card__icon svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.mse-workflow-list {
  position: relative;
  display: grid;
  gap: 34px;
  margin-top: 20px;
}

.mse-workflow-list::before {
  content: "";
  position: absolute;
  top: 24px;
  bottom: 24px;
  left: 50%;
  width: 1px;
  background: linear-gradient(to bottom, transparent, rgba(139, 220, 255, 0.36), transparent);
  transform: translateX(-50%);
}

.mse-workflow-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
  align-items: center;
  gap: 32px;
}

/* .mse-workflow-item::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 14px;
  height: 14px;
  border: 3px solid #070b14;
  border-radius: 999px;
  background: var(--mse-accent);
  box-shadow: 0 0 28px rgba(139, 220, 255, 0.78);
  transform: translate(-50%, -50%);
} */

.mse-workflow-item--reverse {
  grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
}

.mse-workflow-item--reverse .mse-workflow-item__visual {
  order: 2;
}

.mse-workflow-item--reverse .mse-workflow-item__copy {
  order: 1;
}

.mse-workflow-item__visual,
.mse-workflow-item__copy {
  min-width: 0;
}

.mse-workflow-item__copy {
  display: grid;
  gap: 17px;
  padding: clamp(25px, 4vw, 38px);
  border-radius: var(--mse-radius-lg);
}

.mse-media-frame--workflow {
  transition:
    transform 180ms ease,
    border-color 180ms ease;
}

.mse-workflow-item:hover .mse-media-frame--workflow {
  transform: translateY(-4px);
  border-color: rgba(139, 220, 255, 0.3);
}

.mse-looping-video {
  width: 100%;
  height: 100%;
}

.mse-section--tech {
  padding-top: 126px;
}

.mse-tech-layout,
.mse-docs-spotlight {
  display: grid;
  grid-template-columns: minmax(0, 0.94fr) minmax(390px, 0.78fr);
  align-items: center;
  gap: 44px;
}

.mse-docs-spotlight {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  padding: clamp(30px, 4vw, 42px);
  border-radius: 38px;
}

.mse-tech-proof-grid,
.mse-format-card__map {
  display: grid;
  gap: 14px;
}

.mse-tech-proof-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 30px;
}

.mse-tech-proof-card {
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.07);
}

.mse-tech-proof-card h3 {
  margin: 0 0 8px;
  font-size: 18px;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.mse-tech-proof-card p {
  margin: 0;
  color: rgba(247, 248, 255, 0.72);
  line-height: 1.66;
}

.mse-format-card__map {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mse-format-card__map span {
  padding: 9px 12px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 999px;
  color: rgba(247, 248, 255, 0.82);
  background: rgba(255, 255, 255, 0.07);
  font-size: 12px;
  font-weight: 850;
  text-align: center;
}

.mse-format-card {
  padding: 34px;
  border-radius: var(--mse-radius-xl);
}

.mse-format-card__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
}

.mse-format-card__header span {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 28px;
  color: #07101b;
  background: linear-gradient(135deg, #ffffff, #bfefff 45%, #c9bbff);
  box-shadow: 0 22px 54px rgba(139, 220, 255, 0.22);
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -0.06em;
}

.mse-format-card__header strong,
.mse-docs-card__eyebrow,
.mse-docs-card strong {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mse-docs-spotlight__intro {
  display: grid;
  align-content: center;
  gap: 2px;
}

.mse-docs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.mse-docs-card {
  display: grid;
  gap: 14px;
  padding: 24px;
  border-radius: 28px;
  text-decoration: none;
}

.mse-docs-card__eyebrow {
  color: var(--mse-accent);
}

.mse-final-cta {
  padding: 88px 0 108px;
}

.mse-final-cta__panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 34px;
  padding: clamp(30px, 5vw, 52px);
  border-color: rgba(139, 220, 255, 0.27);
  border-radius: 38px;
  background:
    radial-gradient(circle at 84% 10%, rgba(139, 220, 255, 0.17), transparent 32%),
    radial-gradient(circle at 8% 82%, rgba(187, 167, 255, 0.13), transparent 30%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.052));
}

.mse-final-cta__actions {
  flex-direction: column;
  min-width: 260px;
}

@media (max-width: 1380px) {
  .mse-hero__layout {
    grid-template-columns: minmax(0, 0.86fr) minmax(500px, 1.14fr);
    gap: clamp(24px, 4vw, 52px);
  }

  .mse-hero__copy {
    max-width: 560px;
  }

  .mse-hero__showcase .mse-product-frame {
    width: min(100%, 1120px);
  }
}

@media (max-width: 1120px) {
  .mse-hero__layout,
  .mse-tech-layout,
  .mse-docs-spotlight {
    grid-template-columns: 1fr;
  }

  .mse-feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mse-product-frame {
    transform: none;
  }
}

@media (max-width: 860px) {
  .mse-shell,
  .mse-nav {
    width: min(100% - 28px, 1280px);
  }

  .mse-nav {
    grid-template-columns: 1fr auto;
  }

  .mse-nav__links,
  .mse-workflow-list::before,
  .mse-workflow-item::before,
  .mse-floating-card {
    display: none;
  }

  .mse-hero {
    min-height: auto;
    padding: 118px 0 72px;
  }

  .mse-hero h1 {
    max-width: 14ch;
    font-size: clamp(42px, 11vw, 62px);
  }

  .mse-hero__stats,
  .mse-comparison,
  .mse-feature-grid,
  .mse-showcase-grid,
  .mse-tech-proof-grid,
  .mse-docs-grid,
  .mse-final-cta__panel,
  .mse-workflow-item,
  .mse-workflow-item--reverse {
    grid-template-columns: 1fr;
  }

  .mse-workflow-item--reverse .mse-workflow-item__visual,
  .mse-workflow-item--reverse .mse-workflow-item__copy {
    order: initial;
  }

  .mse-section {
    padding: 82px 0;
  }
}

@media (max-width: 560px) {
  .mse-nav {
    top: 10px;
    min-height: 58px;
  }

  .mse-brand span:last-child {
    max-width: 154px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mse-nav__cta {
    min-height: 38px;
    padding: 0 14px;
  }

  .mse-hero__actions,
  .mse-final-cta__actions {
    align-items: stretch;
  }

  .mse-button {
    width: 100%;
  }

  .mse-product-frame__topbar {
    grid-template-columns: 64px 1fr;
  }

  .mse-product-frame__topbar em {
    display: none;
  }

  .mse-media-shell--hero {
    min-height: auto;
  }
}
</style>
