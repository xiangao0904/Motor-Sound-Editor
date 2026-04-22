import { shallowRef } from "vue";
import { defineStore } from "pinia";

import type { ID } from "@/types/common";

export const useAssetPayloadStore = defineStore("assetPayloads", () => {
  const payloads = shallowRef(new Map<ID, Uint8Array>());

  function setPayload(assetId: ID, bytes: Uint8Array) {
    const next = new Map(payloads.value);
    next.set(assetId, bytes);
    payloads.value = next;
  }

  function getPayload(assetId: ID): Uint8Array | null {
    return payloads.value.get(assetId) ?? null;
  }

  function removePayload(assetId: ID) {
    if (!payloads.value.has(assetId)) return;

    const next = new Map(payloads.value);
    next.delete(assetId);
    payloads.value = next;
  }

  function clear() {
    payloads.value = new Map();
  }

  return {
    payloads,
    setPayload,
    getPayload,
    removePayload,
    clear,
  };
});
