import { toRaw } from "vue";

export function deepClone<T>(value: T): T {
  return structuredClone(toRaw(value));
}
