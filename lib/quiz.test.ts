import { buildQuizFromTaskTitle } from "@/lib/quiz";

describe("buildQuizFromTaskTitle", () => {
  it("uses calculus-specific fallback questions for calculus topics", () => {
    const quiz = buildQuizFromTaskTitle("Learn calculus derivatives and limits");

    expect(quiz.title).toContain("Calculus check");
    expect(quiz.questions).toHaveLength(3);
    expect(quiz.questions[0].prompt.toLowerCase()).toContain("derivative");
  });

  it("generates applied questions for unseen subjects", () => {
    const quiz = buildQuizFromTaskTitle("Nuclear engineering reactor safety fundamentals");

    expect(quiz.title).toContain("Applied check");
    expect(quiz.questions).toHaveLength(3);
    quiz.questions.forEach((q) => {
      expect(q.prompt.toLowerCase()).toContain("nuclear engineering reactor safety fundamentals");
    });
  });

  it("uses debugging wording for fix-style tasks", () => {
    const quiz = buildQuizFromTaskTitle("Fix memory leak in parser");
    const prompts = quiz.questions.map((q) => q.prompt.toLowerCase()).join(" ");

    expect(prompts).toContain("debugging");
    expect(prompts).not.toContain("best first step to study");
  });

  it("keeps options valid and shuffles correct index", () => {
    const quiz = buildQuizFromTaskTitle("Python linked list implementation");

    quiz.questions.forEach((q) => {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    });
  });
});
