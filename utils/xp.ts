/** Pure helper for tests and optimistic UI; server is source of truth for persisted XP. */
export function xpAfterCompletingTask(currentXp: number, taskXpValue: number): number {
  return currentXp + taskXpValue;
}
