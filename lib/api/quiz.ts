import type { TaskQuiz } from "@/lib/quiz";
import { env } from "@/utils/env";

type UnknownRecord = Record<string, unknown>;

export type GenerateQuizInput = {
  taskTitle: string;
  proofUrl?: string | null;
};

type QuizMeta = {
  fallback?: string;
};

export type GenerateQuizResult = {
  quiz: TaskQuiz;
  fallbackReason?: string;
};

function buildAIGatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const anonKey = env.supabaseAnonKey.trim();
  if (!anonKey) return headers;
  headers.apikey = anonKey;
  headers.Authorization = `Bearer ${anonKey}`;
  return headers;
}

function parseQuestion(candidate: unknown): TaskQuiz["questions"][number] | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as UnknownRecord;

  const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
  const explanation = typeof row.explanation === "string" ? row.explanation.trim() : "";
  const rawOptions = Array.isArray(row.options) ? row.options : [];
  const options = rawOptions
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
  const correctIndex = typeof row.correctIndex === "number" ? row.correctIndex : -1;

  if (!prompt || !explanation || options.length < 2) return null;
  if (correctIndex < 0 || correctIndex >= options.length) return null;

  return {
    prompt,
    options,
    correctIndex,
    explanation,
  };
}

export function parseGeneratedQuiz(payload: unknown): TaskQuiz {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response must contain a quiz object.");
  }

  const obj = payload as UnknownRecord;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : null;

  if (!title || !rawQuestions) {
    throw new Error("AI response must contain quiz title and questions.");
  }

  const questions = rawQuestions.map((value) => parseQuestion(value)).filter(Boolean) as TaskQuiz["questions"];
  if (questions.length === 0) {
    throw new Error("AI did not return valid quiz questions.");
  }

  return { title, questions };
}

export async function generateQuizFromContext(
  aiGatewayUrl: string,
  input: GenerateQuizInput,
): Promise<GenerateQuizResult> {
  const taskTitle = input.taskTitle.trim();
  if (!taskTitle) throw new Error("Task title is required for quiz generation.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: buildAIGatewayHeaders(),
      body: JSON.stringify({
        mode: "quiz",
        quiz: {
          topic: taskTitle,
          sourceUrl: input.proofUrl ?? undefined,
          constraints: {
            questionCount: 3,
            style: "applied",
            avoidStudyHabits: true,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI quiz generation failed (${response.status}).`);
    }

    const payload = (await response.json()) as unknown;
    const quiz = parseGeneratedQuiz(payload);
    const meta =
      payload && typeof payload === "object" && "meta" in payload ? ((payload as UnknownRecord).meta as QuizMeta) : undefined;
    const fallbackReason = typeof meta?.fallback === "string" ? meta.fallback : undefined;
    return { quiz, fallbackReason };
  } finally {
    clearTimeout(timeout);
  }
}
