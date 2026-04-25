<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  src: string;
  label: string;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const isVisible = ref(true);

let visibilityHandler: (() => void) | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let retryTimer: number | null = null;

function clearRetryTimer() {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function shouldBePlaying() {
  return !document.hidden && isVisible.value;
}

function queueReplay(delay = 160) {
  clearRetryTimer();
  retryTimer = window.setTimeout(() => {
    void syncPlayback();
  }, delay);
}

async function syncPlayback() {
  const video = videoRef.value;
  if (!video) return;

  if (!shouldBePlaying()) {
    if (!video.paused) {
      video.pause();
    }
    return;
  }

  if (video.ended) {
    video.currentTime = 0;
  }

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    video.load();
  }

  try {
    await video.play();
  } catch {
    queueReplay(260);
  }
}

function handlePlaybackDrift() {
  const video = videoRef.value;
  if (!video || !shouldBePlaying()) return;

  if (video.paused || video.ended) {
    queueReplay(80);
  }
}

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.muted = true;
    videoRef.value.defaultMuted = true;
    videoRef.value.playsInline = true;
    videoRef.value.loop = true;
  }

  visibilityHandler = () => {
    void syncPlayback();
  };
  document.addEventListener("visibilitychange", visibilityHandler);

  if ("IntersectionObserver" in window) {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisible.value = entry?.isIntersecting ?? true;
        void syncPlayback();
      },
      {
        threshold: 0.35,
      },
    );

    if (videoRef.value) {
      intersectionObserver.observe(videoRef.value);
    }
  }

  void syncPlayback();
});

onBeforeUnmount(() => {
  clearRetryTimer();
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
  }
  intersectionObserver?.disconnect();
});
</script>

<template>
  <video
    ref="videoRef"
    class="mse-looping-video"
    :src="props.src"
    :aria-label="props.label"
    autoplay
    muted
    loop
    playsinline
    preload="auto"
    defaultmuted
    @canplay="syncPlayback"
    @loadeddata="syncPlayback"
    @pause="handlePlaybackDrift"
    @stalled="queueReplay()"
    @suspend="queueReplay(220)"
    @ended="queueReplay(0)"
  ></video>
</template>
