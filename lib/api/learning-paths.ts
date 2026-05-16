import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateTaskInput } from "@/lib/api/tasks";

type LearningPathRow = Database["public"]["Tables"]["learning_paths"]["Row"];
type SkillRow = Database["public"]["Tables"]["skills"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type RewardRow = Database["public"]["Tables"]["task_quiz_rewards"]["Row"];

export type CreateLearningPathInput = {
  title: string;
  sourceName?: string | null;
  sourceKind?: string;
};

export type CreateSkillInput = {
  name: string;
  description: string;
  orderIndex: number;
  unlockXp: number;
};

export type SkillProgressRow = {
  skill: SkillRow;
  earnedXp: number;
  completedTasks: number;
};

function cleanTitle(value: string): string {
  return value.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchLearningPathsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<LearningPathRow[]> {
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createLearningPath(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateLearningPathInput,
): Promise<LearningPathRow> {
  const title = cleanTitle(input.title) || "Learning path";
  const { data, error } = await supabase
    .from("learning_paths")
    .insert({
      user_id: userId,
      title,
      source_name: input.sourceName ?? null,
      source_kind: input.sourceKind ?? "manual",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createSkillsForPath(
  supabase: SupabaseClient<Database>,
  userId: string,
  learningPathId: string,
  inputs: CreateSkillInput[],
): Promise<SkillRow[]> {
  if (inputs.length === 0) return [];
  const payload = inputs.map((input) => ({
    user_id: userId,
    learning_path_id: learningPathId,
    name: input.name.trim(),
    description: input.description.trim(),
    order_index: input.orderIndex,
    unlock_xp: Math.max(1, Math.round(input.unlockXp)),
  }));
  const { data, error } = await supabase.from("skills").insert(payload).select("*");
  if (error) throw error;
  return (data ?? []).sort((a, b) => a.order_index - b.order_index);
}

export function buildSkillNodesFromGeneratedTasks(tasks: CreateTaskInput[]): CreateSkillInput[] {
  const byPrefix = new Map<string, CreateTaskInput[]>();
  tasks.forEach((task) => {
    const firstChunk =
      task.title
        .split(/[:\-|]/)
        .map((chunk) => chunk.trim())
        .find(Boolean) ?? task.title;
    const key = cleanTitle(firstChunk).toLowerCase() || "core";
    const list = byPrefix.get(key) ?? [];
    list.push(task);
    byPrefix.set(key, list);
  });

  const groups = Array.from(byPrefix.entries()).slice(0, 6);
  return groups.map(([key, groupedTasks], index) => {
    const totalXp = groupedTasks.reduce((sum, task) => sum + task.xpValue, 0);
    return {
      name: cleanTitle(key),
      description: `Complete ${groupedTasks.length} task${groupedTasks.length === 1 ? "" : "s"} to master this skill.`,
      orderIndex: index,
      unlockXp: Math.max(20, totalXp),
    };
  });
}

export async function fetchSkillsForPath(
  supabase: SupabaseClient<Database>,
  userId: string,
  learningPathId: string,
): Promise<SkillRow[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("user_id", userId)
    .eq("learning_path_id", learningPathId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSkillProgressForPath(
  supabase: SupabaseClient<Database>,
  userId: string,
  learningPathId: string,
): Promise<SkillProgressRow[]> {
  const [skills, tasksResp] = await Promise.all([
    fetchSkillsForPath(supabase, userId, learningPathId),
    supabase
      .from("tasks")
      .select("id,user_id,skill_id,xp_value,completed")
      .eq("user_id", userId)
      .eq("learning_path_id", learningPathId),
  ]);

  if (tasksResp.error) throw tasksResp.error;
  const tasks = (tasksResp.data ?? []) as Pick<TaskRow, "id" | "skill_id" | "xp_value" | "completed">[];
  const taskIds = tasks.map((task) => task.id);

  let rewards: Pick<RewardRow, "task_id" | "bonus_xp">[] = [];
  if (taskIds.length > 0) {
    const rewardsResp = await supabase
      .from("task_quiz_rewards")
      .select("task_id,bonus_xp")
      .eq("user_id", userId)
      .in("task_id", taskIds);
    if (rewardsResp.error) throw rewardsResp.error;
    rewards = (rewardsResp.data ?? []) as Pick<RewardRow, "task_id" | "bonus_xp">[];
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const bonusBySkillId = new Map<string, number>();
  rewards.forEach((reward) => {
    const task = taskById.get(reward.task_id);
    if (!task?.skill_id) return;
    bonusBySkillId.set(task.skill_id, (bonusBySkillId.get(task.skill_id) ?? 0) + reward.bonus_xp);
  });

  return skills.map((skill) => {
    const relatedTasks = tasks.filter((task) => task.skill_id === skill.id);
    const completionXp = relatedTasks
      .filter((task) => task.completed)
      .reduce((sum, task) => sum + task.xp_value, 0);
    return {
      skill,
      earnedXp: completionXp + (bonusBySkillId.get(skill.id) ?? 0),
      completedTasks: relatedTasks.filter((task) => task.completed).length,
    };
  });
}
