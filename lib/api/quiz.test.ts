import { generateQuizFromContext, parseGeneratedQuiz } from "./quiz";

describe("parseGeneratedQuiz", () => {
  it("accepts valid quiz payload", () => {
    const quiz = parseGeneratedQuiz({
      title: "Applied check: Nuclear Engineering",
      questions: [
        {
          prompt: "Which assumption should be validated first?",
          options: ["Boundary conditions", "UI labels", "Color themes", "File names"],
          correctIndex: 0,
          explanation: "Boundary conditions drive validity.",
        },
      ],
    });

    expect(quiz.title).toContain("Nuclear Engineering");
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0].correctIndex).toBe(0);
  });

  it("throws when title or questions missing", () => {
    expect(() => parseGeneratedQuiz({ questions: [] })).toThrow(
      "AI response must contain quiz title and questions.",
    );
  });

  it("throws when parsed questions are invalid", () => {
    expect(() =>
      parseGeneratedQuiz({
        title: "Quiz",
        questions: [{ prompt: "", options: [], correctIndex: 0, explanation: "" }],
      }),
    ).toThrow("AI did not return valid quiz questions.");
  });
});

describe("generateQuizFromContext", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("posts quiz mode payload and parses response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: "Applied check: Python",
        questions: [
          {
            prompt: "What is wrong with this code?",
            options: ["Shared mutable default", "Syntax color", "Comments missing", "No README"],
            correctIndex: 0,
            explanation: "Mutable defaults persist.",
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateQuizFromContext("https://example.ai/generate", {
      taskTitle: "Python linked list",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.ai/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(result.quiz.title).toContain("Python");
  });

  it("exposes fallback metadata when returned by API", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: "Applied check: Calculus",
        questions: [
          {
            prompt: "Question?",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "Because.",
          },
        ],
        meta: {
          fallback: "mock_quiz_due_to_invalid_model_json",
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateQuizFromContext("https://example.ai/generate", {
      taskTitle: "Learn derivatives",
    });

    expect(result.fallbackReason).toBe("mock_quiz_due_to_invalid_model_json");
  });
});
