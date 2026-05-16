const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const DEFAULT_XP = 20;
const DEFAULT_MODEL = "gemini-2.5-flash";

type UnknownRecord = Record<string, unknown>;
type Mode = "tasks" | "quiz";
type SourceDocumentInput = {
  name?: string;
  mimeType?: string;
  base64: string;
};
type TaskItem = {
  title: string;
  xp_value: number;
  skill_key?: string | null;
};
type SkillItem = {
  key: string;
  name: string;
  description: string;
  order_index: number;
  unlock_xp: number;
};
type TaskBundle = {
  tasks: TaskItem[];
  skills: SkillItem[];
  task_skill_map: Array<string | null>;
};
type QuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};
type QuizPayload = {
  title: string;
  questions: QuizQuestion[];
};

const GENERIC_TASK_PATTERNS: RegExp[] = [
  /\bstudy\b/i,
  /\blearn more\b/i,
  /\breview notes?\b/i,
  /\bpractice\b/i,
  /\bread\b/i,
  /\bunderstand\b/i,
  /\bimprove\b/i,
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(raw: string): string {
  return raw.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLearningGoal(raw: string): string {
  let text = raw.trim().replace(/[.?!]+$/g, "");
  const patterns: RegExp[] = [
    /^(?:i\s+)?(?:want|need|would\s+like|am\s+trying)\s+to\s+(?:learn|study|understand|master)\s+/i,
    /^(?:i'?m\s+)?(?:learning|studying|understanding|mastering)\s+/i,
    /^(?:learn|study|understand|master)\s+/i,
    /^how\s+to\s+/i,
    /^about\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = text.replace(pattern, "").trim();
      if (next && next !== text) {
        text = next;
        changed = true;
      }
    }
  }

  text = text
    .replace(/\bfundementals?\b/gi, "fundamentals")
    .replace(/\bcomputer\s+fundamental\b/gi, "computer fundamentals")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/\bwith\s+(python|go|javascript|typescript|java|rust|c\+\+|c#)\b/gi, "in $1")
    .replace(/\s+/g, " ")
    .trim();

  return text || raw.trim();
}

function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-");
  return value ? value : null;
}

function normalizeXp(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_XP;
  const rounded = Math.round(raw);
  if (rounded < 1) return 1;
  if (rounded > 500) return 500;
  return rounded;
}

function parseTaskCandidate(candidate: unknown): TaskItem | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as UnknownRecord;
  const titleRaw = row.title ?? row.task ?? row.name;
  if (typeof titleRaw !== "string") return null;
  const title = titleRaw.trim();
  if (!title) return null;
  const xpRaw = row.xp_value ?? row.xpValue ?? row.xp;
  const skillKey = normalizeKey(row.skill_key ?? row.skillKey ?? row.skill);
  return { title, xp_value: normalizeXp(xpRaw), skill_key: skillKey };
}

function isGenericTaskTitle(title: string): boolean {
  const clean = normalizeText(title).toLowerCase();
  if (!clean) return true;
  if (clean.length < 18) return true;
  if (clean.split(" ").length < 4) return true;
  return GENERIC_TASK_PATTERNS.some((pattern) => pattern.test(clean));
}

function scoreTaskSpecificity(title: string): number {
  const clean = normalizeText(title).toLowerCase();
  const words = clean.split(" ").filter(Boolean);
  const nonTrivialWords = words.filter((word) => word.length >= 5).length;
  const hasDelimiter = /[:\-]/.test(title);
  let score = 0;
  score += Math.min(2, Math.floor(words.length / 3));
  score += nonTrivialWords >= 2 ? 1 : 0;
  score += hasDelimiter ? 1 : 0;
  if (!isGenericTaskTitle(title)) score += 2;
  return score;
}

function enforceTaskQuality(bundle: TaskBundle, contextSeed: string): TaskBundle {
  const withScores = bundle.tasks.map((task) => ({ task, score: scoreTaskSpecificity(task.title) }));
  const lowQuality = withScores.filter((entry) => entry.score <= 2).length;
  if (lowQuality === 0) return bundle;

  // If model output is too generic, replace with deterministic applied tasks for reliability.
  if (lowQuality >= Math.ceil(bundle.tasks.length / 2)) {
    return buildMockTasks(contextSeed);
  }

  // Otherwise patch only weak titles while preserving user/domain signal.
  const topic = normalizeText(contextSeed) || "the selected material";
  const repairedTasks = bundle.tasks.map((task, index) => {
    if (scoreTaskSpecificity(task.title) > 2) return task;
    return {
      ...task,
      title: `Applied task ${index + 1}: Solve one realistic ${topic} scenario and explain the failure mode.`,
    };
  });
  return {
    ...bundle,
    tasks: repairedTasks,
  };
}

function parseSkillCandidate(candidate: unknown, fallbackIndex: number): SkillItem | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as UnknownRecord;
  const nameRaw = row.name ?? row.title ?? row.skill;
  if (typeof nameRaw !== "string" || !nameRaw.trim()) return null;
  const key = normalizeKey(row.key ?? row.skill_key ?? row.skillKey ?? nameRaw) ?? `skill-${fallbackIndex + 1}`;
  const description =
    typeof row.description === "string" && row.description.trim()
      ? row.description.trim()
      : `Build mastery in ${nameRaw.trim()}.`;
  const unlockRaw = row.unlock_xp ?? row.unlockXp ?? row.target_xp ?? row.targetXp;
  const unlockXp =
    typeof unlockRaw === "number" && Number.isFinite(unlockRaw) ? Math.max(1, Math.round(unlockRaw)) : 20;
  const orderRaw = row.order_index ?? row.orderIndex ?? row.order;
  const orderIndex =
    typeof orderRaw === "number" && Number.isFinite(orderRaw) ? Math.max(0, Math.round(orderRaw)) : fallbackIndex;
  return {
    key,
    name: nameRaw.trim(),
    description,
    order_index: orderIndex,
    unlock_xp: unlockXp,
  };
}

function sanitizeTasksPayload(payload: unknown): TaskBundle {
  let rawTasks: unknown[] | null = null;
  let rawSkills: unknown[] | null = null;
  let rawTaskSkillMap: unknown[] | null = null;

  if (Array.isArray(payload)) {
    rawTasks = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as UnknownRecord;
    if (Array.isArray(obj.tasks)) rawTasks = obj.tasks;
    if (Array.isArray(obj.skills)) rawSkills = obj.skills;
    if (Array.isArray(obj.task_skill_map)) rawTaskSkillMap = obj.task_skill_map;
  }
  if (!rawTasks) throw new Error("Model output must include a tasks array.");

  const tasks = rawTasks
    .map((item) => parseTaskCandidate(item))
    .filter((item): item is TaskItem => Boolean(item))
    .slice(0, 12);
  if (tasks.length === 0) throw new Error("Model output did not include valid task items.");

  const skills = (rawSkills ?? [])
    .map((entry, index) => parseSkillCandidate(entry, index))
    .filter((entry): entry is SkillItem => Boolean(entry))
    .sort((a, b) => a.order_index - b.order_index);

  const taskSkillMap = tasks.map((task, index) => {
    const fromMap = normalizeKey((rawTaskSkillMap ?? [])[index]);
    return fromMap ?? task.skill_key ?? null;
  });

  return { tasks, skills, task_skill_map: taskSkillMap };
}

function parseQuizQuestion(candidate: unknown): QuizQuestion | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as UnknownRecord;
  const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
  const explanation = typeof row.explanation === "string" ? row.explanation.trim() : "";
  const options = Array.isArray(row.options)
    ? row.options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : -1;
  if (!prompt || !explanation || options.length < 2) return null;
  if (correctIndex < 0 || correctIndex >= options.length) return null;
  return { prompt, options, correctIndex, explanation };
}

function sanitizeQuizPayload(payload: unknown): QuizPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Model output must include quiz JSON object.");
  }
  const root = payload as UnknownRecord;
  const titleRaw = root.title;
  const questionsRaw = root.questions;
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title || !Array.isArray(questionsRaw)) {
    throw new Error("Model quiz output must include title and questions.");
  }
  const questions = questionsRaw
    .map((item) => parseQuizQuestion(item))
    .filter((item): item is QuizQuestion => Boolean(item))
    .slice(0, 5);
  if (questions.length === 0) throw new Error("Model quiz output did not include valid questions.");
  return { title, questions };
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Model returned empty text.");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const indices = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (indices.length === 0) throw new Error("Model response did not include JSON.");
  return trimmed.slice(Math.min(...indices));
}

function extractBalancedJsonCandidate(text: string): string | null {
  const startObject = text.indexOf("{");
  const startArray = text.indexOf("[");
  const starts = [startObject, startArray].filter((v) => v >= 0);
  if (starts.length === 0) return null;

  const start = Math.min(...starts);
  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaping) escaping = false;
      else if (ch === "\\") escaping = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === opening) depth += 1;
    if (ch === closing) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonWithRecovery(text: string): unknown {
  const primary = extractJsonBlock(text);
  try {
    return JSON.parse(primary);
  } catch {
    const balanced = extractBalancedJsonCandidate(primary);
    if (!balanced) throw new Error("Model response did not contain parseable JSON.");
    return JSON.parse(balanced);
  }
}

function parseGeminiResponse(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") throw new Error("Unexpected Gemini response shape.");
  const candidates = (payload as UnknownRecord).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("No Gemini candidates returned.");
  const content = candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as UnknownRecord).content : null;
  if (!content || typeof content !== "object") throw new Error("Missing candidate content.");
  const parts = (content as UnknownRecord).parts;
  if (!Array.isArray(parts)) throw new Error("Missing content parts.");
  const text = parts
    .map((part) => (part && typeof part === "object" ? (part as UnknownRecord).text : ""))
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned empty content.");
  return parseJsonWithRecovery(text);
}

function buildTaskPrompt(goal: string, sourceDocument?: SourceDocumentInput): string {
  const context = goal
    ? `User goal: ${goal}`
    : "User goal: Derive actionable study tasks from the uploaded document.";
  return [
    "You generate applied learning tasks for a student app.",
    "Return ONLY valid JSON. No markdown. No explanations.",
    'Output JSON shape: {"tasks":[{"title":"string","xp_value":number,"skill_key":"string?"}],"skills":[{"key":"string","name":"string","description":"string","order_index":number,"unlock_xp":number}],"task_skill_map":["skill-key"]}',
    "Rules:",
    "- Return 4 to 8 tasks, concise and specific.",
    "- xp_value must be integer 10..60.",
    "- Return 3 to 6 skills when possible, aligned to tasks.",
    "- Use kebab-case keys for skill_key and skills[].key.",
    "- task_skill_map[i] maps tasks[i] to skills[].key.",
    "- Prefer practical tasks over generic study-habit wording.",
    sourceDocument?.name ? `Source document name: ${sourceDocument.name}` : "",
    context,
  ].join("\n");
}

function buildTaskRetryPrompt(goal: string, sourceDocument?: SourceDocumentInput): string {
  return [
    buildTaskPrompt(goal, sourceDocument),
    "",
    "IMPORTANT:",
    "- Output a single raw JSON object only.",
    "- Do not wrap JSON in code fences.",
    "- Do not include any text before or after the JSON object.",
  ].join("\n");
}

function buildQuizPrompt(topic: string, sourceUrl?: string, questionCount = 3): string {
  return [
    "You generate an applied skill-check quiz for students.",
    "Return ONLY valid JSON. No markdown. No explanations.",
    'Output JSON shape: {"title":"string","questions":[{"prompt":"string","options":["a","b","c","d"],"correctIndex":0,"explanation":"string"}]}',
    "Rules:",
    `- Return exactly ${questionCount} questions.`,
    "- Each question must be practical and topic-specific.",
    "- Avoid generic study-habit advice.",
    "- options length must be 4.",
    "- correctIndex must be 0..3 and match the correct option.",
    sourceUrl ? `Source URL context: ${sourceUrl}` : "",
    `Topic: ${topic}`,
  ].join("\n");
}

function buildQuizRetryPrompt(topic: string, sourceUrl?: string, questionCount = 3): string {
  return [
    buildQuizPrompt(topic, sourceUrl, questionCount),
    "",
    "IMPORTANT:",
    "- Output a single raw JSON object only.",
    "- Do not wrap JSON in code fences.",
    "- Do not include any text before or after the JSON object.",
  ].join("\n");
}

function toInlineDataBase64(value: string): string {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) return trimmed.slice(commaIndex + 1);
  return trimmed;
}

function isCalculusTopic(topic: string): boolean {
  const lower = normalizeText(topic).toLowerCase();
  return /\b(calculus|derivative|integral|limit|chain rule|product rule|implicit differentiation|related rates|series)\b/i.test(
    lower,
  );
}

function buildMockTasks(seed: string): TaskBundle {
  const topic = normalizeText(seed) || "the uploaded material";
  if (isCalculusTopic(topic)) {
    const tasks: TaskItem[] = [
      {
        title: `Solve 10 mixed limit and derivative problems for ${topic} and show each step clearly`,
        xp_value: 25,
        skill_key: "limits-and-derivatives",
      },
      {
        title: `Practice chain rule, product rule, and quotient rule on ${topic} examples`,
        xp_value: 20,
        skill_key: "differentiation-techniques",
      },
      {
        title: `Apply derivatives in 5 optimization or related-rates scenarios tied to ${topic}`,
        xp_value: 25,
        skill_key: "applied-calculus-modeling",
      },
      {
        title: `Review and correct common mistakes in ${topic}, then write the fixed solution path`,
        xp_value: 20,
        skill_key: "error-analysis",
      },
    ];
    const skills: SkillItem[] = [
      {
        key: "limits-and-derivatives",
        name: "Limits and Derivatives",
        description: "Build fluency with foundational derivative workflow.",
        order_index: 0,
        unlock_xp: 40,
      },
      {
        key: "differentiation-techniques",
        name: "Differentiation Techniques",
        description: "Use core derivative rules with confidence.",
        order_index: 1,
        unlock_xp: 50,
      },
      {
        key: "applied-calculus-modeling",
        name: "Applied Calculus Modeling",
        description: "Translate word problems into derivative-based models.",
        order_index: 2,
        unlock_xp: 60,
      },
      {
        key: "error-analysis",
        name: "Error Analysis",
        description: "Find and correct high-frequency calculus mistakes.",
        order_index: 3,
        unlock_xp: 40,
      },
    ];
    return {
      tasks,
      skills,
      task_skill_map: tasks.map((task) => task.skill_key ?? null),
    };
  }

  const tasks: TaskItem[] = [
    { title: `Build a concept map for ${topic}`, xp_value: 20, skill_key: "concept-mapping" },
    { title: `Solve 8 applied problems in ${topic}`, xp_value: 25, skill_key: "applied-practice" },
    { title: `Debug one incorrect solution from ${topic}`, xp_value: 20, skill_key: "error-analysis" },
    { title: `Create a mini cheat-sheet for high-risk ${topic} mistakes`, xp_value: 20, skill_key: "retention" },
  ];
  const skills: SkillItem[] = [
    { key: "concept-mapping", name: "Concept Mapping", description: "Organize core ideas quickly.", order_index: 0, unlock_xp: 40 },
    { key: "applied-practice", name: "Applied Practice", description: "Solve realistic problems with constraints.", order_index: 1, unlock_xp: 60 },
    { key: "error-analysis", name: "Error Analysis", description: "Find why wrong answers fail.", order_index: 2, unlock_xp: 40 },
    { key: "retention", name: "Retention", description: "Retain high-value patterns for exams.", order_index: 3, unlock_xp: 40 },
  ];
  return {
    tasks,
    skills,
    task_skill_map: tasks.map((task) => task.skill_key ?? null),
  };
}

function buildMockQuiz(topic: string): QuizPayload {
  const clean = normalizeText(topic) || "this topic";
  if (isCalculusTopic(clean)) {
    return {
      title: `Calculus check: ${clean}`,
      questions: [
        {
          prompt: `When solving a derivative problem in "${clean}", what is the most reliable first step?`,
          options: [
            "Rewrite the function clearly and identify which derivative rule applies before differentiating.",
            "Jump straight to algebraic simplification and skip rule selection.",
            "Memorize the final answer pattern without checking the function form.",
            "Differentiate mentally and verify only if the answer looks unusual.",
          ],
          correctIndex: 0,
          explanation: "Rule selection from a clean function form prevents most early derivative errors.",
        },
        {
          prompt: `In applied "${clean}" questions, what usually prevents optimization mistakes?`,
          options: [
            "Define the objective function and constraints before taking derivatives.",
            "Take second derivatives first to save time.",
            "Use only numeric trial-and-error instead of symbolic setup.",
            "Ignore domain restrictions until the final line.",
          ],
          correctIndex: 0,
          explanation: "Clear objective and constraints ensure derivatives are used on the correct model.",
        },
        {
          prompt: `Which mistake most often causes incorrect answers in "${clean}"?`,
          options: [
            "Dropping chain-rule factors or sign changes during intermediate steps.",
            "Writing too much explanation beside each step.",
            "Checking endpoint values in closed-interval optimization.",
            "Sketching a quick graph before finalizing the answer.",
          ],
          correctIndex: 0,
          explanation: "Missing inner-function factors and signs is a high-frequency calculus error source.",
        },
      ],
    };
  }

  return {
    title: `Applied check: ${clean}`,
    questions: [
      {
        prompt: `What is the best first check when an implementation in "${clean}" produces unstable results?`,
        options: [
          "Validate assumptions and edge-case constraints against a minimal reproducible case.",
          "Rewrite the full project before identifying root cause.",
          "Ignore inconsistencies if average output looks acceptable.",
          "Optimize performance before validating correctness.",
        ],
        correctIndex: 0,
        explanation: "A reproducible case tied to assumptions reveals root causes quickly.",
      },
      {
        prompt: `In "${clean}", which approach improves long-term mastery fastest?`,
        options: [
          "Apply concepts to unfamiliar scenarios and review failure reasons.",
          "Memorize final answers without checking process.",
          "Repeat only easiest examples.",
          "Skip verification to move faster.",
        ],
        correctIndex: 0,
        explanation: "Transfer practice and error review build durable understanding.",
      },
      {
        prompt: `Which risk is most often underestimated in practical "${clean}" work?`,
        options: [
          "Unvalidated edge cases causing silent correctness or safety failures.",
          "Having too many review checklists.",
          "Documenting assumptions explicitly.",
          "Using short feedback loops in testing.",
        ],
        correctIndex: 0,
        explanation: "Most incidents come from ignored edge conditions, not average-case flows.",
      },
    ],
  };
}

function isQuotaErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("429") || normalized.includes("resource_exhausted") || normalized.includes("quota");
}

function isModelUnavailableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("404") ||
    normalized.includes("not_found") ||
    normalized.includes("no longer available to new users") ||
    (normalized.includes("model") && normalized.includes("not available"))
  );
}

function isJsonParseFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unterminated string in json") ||
    normalized.includes("unexpected token") ||
    normalized.includes("parseable json")
  );
}

async function callGemini(
  apiKey: string,
  model: string,
  promptText: string,
  sourceDocument?: SourceDocumentInput,
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts: Array<Record<string, unknown>> = [{ text: promptText }];
  if (sourceDocument?.base64) {
    parts.push({
      inlineData: {
        mimeType: sourceDocument.mimeType || "application/octet-stream",
        data: toInlineDataBase64(sourceDocument.base64),
      },
    });
  }
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.35,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
    },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as UnknownRecord).error
        : payload;
    throw new Error(`Gemini request failed (${response.status}): ${JSON.stringify(detail)}`);
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed. Use POST." });

  try {
    const body = (await req.json()) as UnknownRecord;
    const mode = (typeof body.mode === "string" ? body.mode : "tasks") as Mode;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse(500, { error: "Missing GEMINI_API_KEY secret." });
    const model = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_MODEL;

    if (mode === "quiz") {
      const quizInput = body.quiz && typeof body.quiz === "object" ? (body.quiz as UnknownRecord) : {};
      const topic = typeof quizInput.topic === "string" ? quizInput.topic.trim() : "";
      const sourceUrl = typeof quizInput.sourceUrl === "string" ? quizInput.sourceUrl : undefined;
      const constraints =
        quizInput.constraints && typeof quizInput.constraints === "object"
          ? (quizInput.constraints as UnknownRecord)
          : {};
      const questionCountRaw = constraints.questionCount;
      const questionCount =
        typeof questionCountRaw === "number" && Number.isFinite(questionCountRaw)
          ? Math.max(2, Math.min(5, Math.round(questionCountRaw)))
          : 3;

      if (!topic) return jsonResponse(400, { error: "Quiz mode requires `quiz.topic`." });

      try {
        const prompt = buildQuizPrompt(topic, sourceUrl, questionCount);
        try {
          const geminiPayload = await callGemini(apiKey, model, prompt);
          const parsed = parseGeminiResponse(geminiPayload);
          const quiz = sanitizeQuizPayload(parsed);
          return jsonResponse(200, quiz);
        } catch (firstError) {
          const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
          if (!isJsonParseFailureMessage(firstMessage)) {
            throw firstError;
          }

          // One strict-format retry before fallback to reduce mock-quiz frequency.
          const retryPrompt = buildQuizRetryPrompt(topic, sourceUrl, questionCount);
          const retryPayload = await callGemini(apiKey, model, retryPrompt);
          const retryParsed = parseGeminiResponse(retryPayload);
          const retryQuiz = sanitizeQuizPayload(retryParsed);
          return jsonResponse(200, retryQuiz);
        }
      } catch (modelError) {
        const message = modelError instanceof Error ? modelError.message : String(modelError);
        if (isQuotaErrorMessage(message) || isModelUnavailableMessage(message) || isJsonParseFailureMessage(message)) {
          return jsonResponse(200, {
            ...buildMockQuiz(topic),
            meta: {
              fallback: isModelUnavailableMessage(message)
                ? "mock_quiz_due_to_model_unavailable"
                : isJsonParseFailureMessage(message)
                  ? "mock_quiz_due_to_invalid_model_json"
                  : "mock_quiz_due_to_quota",
            },
          });
        }
        throw modelError;
      }
    }

    const goalRaw = typeof body.goal === "string" ? body.goal.trim() : "";
    const goal = goalRaw ? normalizeLearningGoal(goalRaw) : "";
    const sourceDocument =
      body.sourceDocument && typeof body.sourceDocument === "object"
        ? (body.sourceDocument as SourceDocumentInput)
        : undefined;
    const hasDocument = Boolean(sourceDocument?.base64);
    if (!goal && !hasDocument) {
      return jsonResponse(400, { error: "Request body must include `goal` and/or `sourceDocument.base64`." });
    }

    try {
      const prompt = buildTaskPrompt(goal, sourceDocument);
      const seed = goal || sourceDocument?.name || "your uploaded document";
      try {
        const geminiPayload = await callGemini(apiKey, model, prompt, sourceDocument);
        const parsed = parseGeminiResponse(geminiPayload);
        const taskBundle = sanitizeTasksPayload(parsed);
        return jsonResponse(200, enforceTaskQuality(taskBundle, seed));
      } catch (firstError) {
        const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
        if (!isJsonParseFailureMessage(firstMessage)) {
          throw firstError;
        }

        // One strict-format retry before fallback to reduce mock-task frequency.
        const retryPrompt = buildTaskRetryPrompt(goal, sourceDocument);
        const retryPayload = await callGemini(apiKey, model, retryPrompt, sourceDocument);
        const retryParsed = parseGeminiResponse(retryPayload);
        const retryBundle = sanitizeTasksPayload(retryParsed);
        return jsonResponse(200, enforceTaskQuality(retryBundle, seed));
      }
    } catch (modelError) {
      const message = modelError instanceof Error ? modelError.message : String(modelError);
      if (isQuotaErrorMessage(message) || isModelUnavailableMessage(message) || isJsonParseFailureMessage(message)) {
        const seed = goal || sourceDocument?.name || "your uploaded document";
        return jsonResponse(200, {
          ...buildMockTasks(seed),
          meta: {
            fallback: isModelUnavailableMessage(message)
              ? "mock_due_to_model_unavailable"
              : isJsonParseFailureMessage(message)
                ? "mock_due_to_invalid_model_json"
                : "mock_due_to_quota",
          },
        });
      }
      throw modelError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return jsonResponse(500, { error: message });
  }
});
