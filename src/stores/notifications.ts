import { ref } from "vue";
import { defineStore } from "pinia";

export const useNotificationStore = defineStore("notifications", () => {
  const message = ref("");
  let timer: number | null = null;

  function showToast(nextMessage: string) {
    message.value = nextMessage;

    if (timer !== null) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      if (message.value === nextMessage) {
        message.value = "";
      }
      timer = null;
    }, 2400);
  }

  return {
    message,
    showToast,
  };
});
