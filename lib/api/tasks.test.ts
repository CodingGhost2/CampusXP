import { countCompletedTasks } from "./tasks";

describe("countCompletedTasks", () => {
  it("counts only completed tasks", () => {
    type TasksArg = Parameters<typeof countCompletedTasks>[0];
    const tasks = [
      { completed: true },
      { completed: false },
      { completed: true },
    ] as unknown as TasksArg;

    expect(countCompletedTasks(tasks)).toBe(2);
  });

  it("returns 0 for empty arrays", () => {
    expect(countCompletedTasks([])).toBe(0);
  });
});
