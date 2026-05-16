import type { CreateTaskInput } from "@/lib/api/tasks";
import { env } from "@/utils/env";

const DEFAULT_XP = 20;

type UnknownRecord = Record<string, unknown>;
export type AIDocumentInput = {
  name?: string;
  mimeType?: string;
  base64: string;
};

export type GenerateTasksInput = {
  goal?: string;
  sourceDocument?: AIDocumentInput;
};

export type GeneratedSkillInput = {
  key: string;
  name: string;
  description: string;
  unlockXp: number;
  orderIndex: number;
};

export type GeneratedTasksBundle = {
  tasks: CreateTaskInput[];
  skills: GeneratedSkillInput[];
  taskSkillKeys: Array<string | null>;
};

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

function buildAIGatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const anonKey = env.supabaseAnonKey.trim();
  if (!anonKey) return headers;
  headers.apikey = anonKey;
  headers.Authorization = `Bearer ${anonKey}`;
  return headers;
}

function normalizeXp(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_XP;
  const rounded = Math.round(raw);
  if (rounded < 1) return 1;
  if (rounded > 500) return 500;
  return rounded;
}

function normalizeSkillKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-");
  return value ? value : null;
}

function parseTaskCandidate(candidate: unknown): { task: CreateTaskInput; skillKey: string | null } | null {
  if (!candidate || typeof candidate !== "object") return null;

  const row = candidate as UnknownRecord;
  const titleRaw = row.title ?? row.task ?? row.name;
  if (typeof titleRaw !== "string") return null;
  const title = titleRaw.trim();
  if (!title) return null;

  const xpRaw = row.xp_value ?? row.xpValue ?? row.xp;
  const skillKeyRaw = row.skill_key ?? row.skillKey ?? row.skill_id ?? row.skillId ?? row.skill;
  return {
    task: {
      title,
      xpValue: normalizeXp(xpRaw),
    },
    skillKey: normalizeSkillKey(skillKeyRaw),
  };
}

function parseSkillCandidate(candidate: unknown, fallbackOrderIndex: number): GeneratedSkillInput | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as UnknownRecord;
  const nameRaw = row.name ?? row.title ?? row.skill;
  if (typeof nameRaw !== "string" || !nameRaw.trim()) return null;

  const key =
    normalizeSkillKey(row.key ?? row.skill_key ?? row.skillKey ?? row.slug ?? nameRaw) ??
    `skill-${fallbackOrderIndex + 1}`;
  const description =
    typeof row.description === "string" && row.description.trim()
      ? row.description.trim()
      : `Build mastery in ${nameRaw.trim()}.`;
  const unlockRaw = row.unlock_xp ?? row.unlockXp ?? row.target_xp ?? row.targetXp;
  const unlockXp = typeof unlockRaw === "number" && Number.isFinite(unlockRaw) ? Math.max(1, Math.round(unlockRaw)) : 20;
  const orderRaw = row.order_index ?? row.orderIndex ?? row.order;
  const orderIndex =
    typeof orderRaw === "number" && Number.isFinite(orderRaw)
      ? Math.max(0, Math.round(orderRaw))
      : fallbackOrderIndex;

  return {
    key,
    name: nameRaw.trim(),
    description,
    unlockXp,
    orderIndex,
  };
}

export function parseGeneratedTasksBundle(payload: unknown): GeneratedTasksBundle {
  let rawTasks: unknown[] | null = null;
  let rawSkills: unknown[] | null = null;
  let rawTaskSkillMap: unknown[] | null = null;

  if (Array.isArray(payload)) {
    rawTasks = payload;
  } else if (payload && typeof payload === "object") {
    const obj = payload as UnknownRecord;
    if (Array.isArray(obj.tasks)) {
      rawTasks = obj.tasks;
    }
    if (Array.isArray(obj.skills)) {
      rawSkills = obj.skills;
    }
    if (Array.isArray(obj.task_skill_map)) {
      rawTaskSkillMap = obj.task_skill_map;
    } else if (Array.isArray(obj.taskSkillMap)) {
      rawTaskSkillMap = obj.taskSkillMap;
    }
  }

  if (!rawTasks) {
    throw new Error("AI response must contain a tasks array.");
  }

  const parsed = rawTasks
    .map((candidate) => parseTaskCandidate(candidate))
    .filter((value): value is { task: CreateTaskInput; skillKey: string | null } => Boolean(value));

  if (parsed.length === 0) {
    throw new Error("AI did not return valid task items.");
  }

  const skills = (rawSkills ?? [])
    .map((candidate, index) => parseSkillCandidate(candidate, index))
    .filter((value): value is GeneratedSkillInput => Boolean(value))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const taskSkillKeysFromMap = (rawTaskSkillMap ?? []).map((entry) => normalizeSkillKey(entry));
  const taskSkillKeys = parsed.map((row, idx) => taskSkillKeysFromMap[idx] ?? row.skillKey ?? null);

  return {
    tasks: parsed.map((row) => row.task),
    skills,
    taskSkillKeys,
  };
}

export function parseGeneratedTasks(payload: unknown): CreateTaskInput[] {
  return parseGeneratedTasksBundle(payload).tasks;
}

export async function generateTasksFromGoal(
  aiGatewayUrl: string,
  input: string | GenerateTasksInput,
): Promise<GeneratedTasksBundle> {
  const normalizedInput: GenerateTasksInput =
    typeof input === "string"
      ? { goal: input }
      : {
          goal: input.goal,
          sourceDocument: input.sourceDocument,
        };

  const trimmedGoal = normalizedInput.goal?.trim() ?? "";
  const normalizedGoal = trimmedGoal ? normalizeLearningGoal(trimmedGoal) : "";
  const hasDocument = Boolean(normalizedInput.sourceDocument?.base64);
  if (!normalizedGoal && !hasDocument) {
    throw new Error("Enter a goal or attach a document for AI task generation.");
  }

  const response = await fetch(aiGatewayUrl, {
    method: "POST",
    headers: buildAIGatewayHeaders(),
    body: JSON.stringify({
      goal: normalizedGoal || undefined,
      sourceDocument: normalizedInput.sourceDocument,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: unknown; message?: unknown }
      | null;
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : null;
    throw new Error(
      detail ? `AI gateway failed (${response.status}): ${detail}` : `AI gateway failed (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;
  return parseGeneratedTasksBundle(payload);
}
