import { xpAfterCompletingTask } from './xp';

describe('xpAfterCompletingTask', () => {
  it('adds task XP to current XP', () => {
    expect(xpAfterCompletingTask(100, 20)).toBe(120);
  });

  it('uses default-style task XP (20)', () => {
    expect(xpAfterCompletingTask(0, 20)).toBe(20);
  });

  it('supports custom task XP values', () => {
    expect(xpAfterCompletingTask(50, 15)).toBe(65);
  });

  it('handles zero current XP', () => {
    expect(xpAfterCompletingTask(0, 10)).toBe(10);
  });
});
