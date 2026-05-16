import { generateTasksFromGoal, parseGeneratedTasks } from "./ai";

describe("parseGeneratedTasks", () => {
  it("accepts top-level array payload", () => {
    const tasks = parseGeneratedTasks([
      { title: " Read Python basics ", xp_value: 25 },
      { name: "Practice loops", xp: 10 },
    ]);

    expect(tasks).toEqual([
      { title: "Read Python basics", xpValue: 25 },
      { title: "Practice loops", xpValue: 10 },
    ]);
  });

  it("accepts object payload with tasks array and defaults XP", () => {
    const tasks = parseGeneratedTasks({
      tasks: [{ task: "Build a mini app" }],
    });

    expect(tasks).toEqual([{ title: "Build a mini app", xpValue: 20 }]);
  });

  it("clamps and rounds XP values", () => {
    const tasks = parseGeneratedTasks({
      tasks: [
        { title: "Too low", xpValue: -10 },
        { title: "Rounded", xp_value: 2.7 },
        { title: "Too high", xp: 9999 },
      ],
    });

    expect(tasks).toEqual([
      { title: "Too low", xpValue: 1 },
      { title: "Rounded", xpValue: 3 },
      { title: "Too high", xpValue: 500 },
    ]);
  });

  it("throws when tasks container is missing", () => {
    expect(() => parseGeneratedTasks({ nope: [] })).toThrow(
      "AI response must contain a tasks array.",
    );
  });

  it("throws when all task candidates are invalid", () => {
    expect(() => parseGeneratedTasks({ tasks: [{ xp: 20 }, { title: "   " }] })).toThrow(
      "AI did not return valid task items.",
    );
  });
});

describe("generateTasksFromGoal", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("trims goal and parses successful response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: "Task A", xp_value: 20 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateTasksFromGoal("https://example.ai/tasks", "  learn react native  ");

    expect(fetchMock).toHaveBeenCalledWith("https://example.ai/tasks", {
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({ goal: "react native" }),
    });
    expect(result.tasks).toEqual([{ title: "Task A", xpValue: 20 }]);
    expect(result.skills).toEqual([]);
    expect(result.taskSkillKeys).toEqual([null]);
  });

  it("normalizes conversational goal phrasing", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: "Task A", xp_value: 20 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await generateTasksFromGoal("https://example.ai/tasks", "I want to learn calculus");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.ai/tasks",
      expect.objectContaining({
        body: JSON.stringify({ goal: "calculus" }),
      }),
    );
  });

  it("normalizes typo and language connector phrasing", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: "Task A", xp_value: 20 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await generateTasksFromGoal("https://example.ai/tasks", "computer fundemental with python");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.ai/tasks",
      expect.objectContaining({
        body: JSON.stringify({ goal: "computer fundamentals in python" }),
      }),
    );
  });

  it("keeps short language targets from imperative phrasing", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: "Task A", xp_value: 20 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await generateTasksFromGoal("https://example.ai/tasks", "learn go");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.ai/tasks",
      expect.objectContaining({
        body: JSON.stringify({ goal: "go" }),
      }),
    );
  });

  it("throws for blank goal", async () => {
    await expect(generateTasksFromGoal("https://example.ai/tasks", "   ")).rejects.toThrow(
      "Enter a goal or attach a document for AI task generation.",
    );
  });

  it("accepts document-only generation input", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [{ title: "Task from doc", xp_value: 20 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateTasksFromGoal("https://example.ai/tasks", {
      sourceDocument: {
        name: "syllabus.pdf",
        mimeType: "application/pdf",
        base64: "ZmFrZQ==",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.ai/tasks", {
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        goal: undefined,
        sourceDocument: {
          name: "syllabus.pdf",
          mimeType: "application/pdf",
          base64: "ZmFrZQ==",
        },
      }),
    });
    expect(result.tasks).toEqual([{ title: "Task from doc", xpValue: 20 }]);
  });

  it("parses optional skills and task-skill mapping", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tasks: [
          { title: "Implement linked list insert", xp_value: 30 },
          { title: "Find auth vulnerability", xp_value: 25 },
        ],
        skills: [
          { key: "data-structures", name: "Data Structures", description: "Lists and trees", unlock_xp: 50 },
          { key: "security", name: "Security", description: "Threat modeling", unlock_xp: 60 },
        ],
        task_skill_map: ["data-structures", "security"],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateTasksFromGoal("https://example.ai/tasks", "python systems");

    expect(result.tasks).toHaveLength(2);
    expect(result.skills).toHaveLength(2);
    expect(result.taskSkillKeys).toEqual(["data-structures", "security"]);
  });

  it("throws on non-200 response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(generateTasksFromGoal("https://example.ai/tasks", "goal")).rejects.toThrow(
      "AI gateway failed (503).",
    );
  });
});
