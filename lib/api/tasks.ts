import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

import { xpAfterCompletingTask } from "@/utils/xp";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export async function fetchTasksForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type CreateTaskInput = {
  title: string;
  xpValue: number;
  learningPathId?: string | null;
  skillId?: string | null;
};

export async function createTasksBulk(
  supabase: SupabaseClient<Database>,
  userId: string,
  inputs: CreateTaskInput[],
): Promise<TaskRow[]> {
  if (inputs.length === 0) return [];

  const payload = inputs.map((input) => ({
    user_id: userId,
    title: input.title.trim(),
    completed: false,
    xp_value: input.xpValue,
    proof_url: null,
    learning_path_id: input.learningPathId ?? null,
    skill_id: input.skillId ?? null,
  }));

  const { data, error } = await supabase.from("tasks").insert(payload).select();

  if (error) throw error;
  return data ?? [];
}

export async function createTask(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateTaskInput,
): Promise<TaskRow> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      completed: false,
      xp_value: input.xpValue,
      proof_url: null,
      learning_path_id: input.learningPathId ?? null,
      skill_id: input.skillId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskId: string,
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
  if (error) throw error;
}

/**
 * Marks task complete and adds `xp_value` to `public.users.xp` for that user.
 * Two-step client update (not a single DB transaction); see Phase 2 handoff notes.
 */
export async function completeTask(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskId: string,
): Promise<{ newXp: number }> {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, user_id, completed, xp_value")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!task) throw new Error("Task not found");
  if (task.user_id !== userId) throw new Error("Forbidden");
  if (task.completed) {
    const { data: profile } = await supabase.from("users").select("xp").eq("id", userId).single();
    return { newXp: profile?.xp ?? 0 };
  }

  const { error: updateTaskError } = await supabase
    .from("tasks")
    .update({ completed: true })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (updateTaskError) throw updateTaskError;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("xp")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  const currentXp = profile?.xp ?? 0;
  const newXp = xpAfterCompletingTask(currentXp, task.xp_value);

  const { error: xpError } = await supabase.from("users").update({ xp: newXp }).eq("id", userId);

  if (xpError) throw xpError;

  return { newXp };
}

export function countCompletedTasks(tasks: TaskRow[]): number {
  return tasks.filter((t) => t.completed).length;
}

export async function awardQuizBonusXp(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  bonusXp: number,
): Promise<{ newXp: number; awarded: boolean }> {
  if (!Number.isFinite(bonusXp) || bonusXp <= 0) {
    throw new Error("Quiz bonus XP must be a positive number.");
  }
  if (!taskId) {
    throw new Error("Task id is required for quiz bonus.");
  }

  const { data: rewardRow, error: rewardError } = await supabase
    .from("task_quiz_rewards")
    .upsert(
      {
        user_id: userId,
        task_id: taskId,
        bonus_xp: Math.round(bonusXp),
      },
      { onConflict: "user_id,task_id", ignoreDuplicates: true },
    )
    .select("user_id")
    .maybeSingle();
  if (rewardError) throw rewardError;

  // Unique (user_id, task_id) means no new reward row => already claimed earlier.
  if (!rewardRow) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("xp")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    return { newXp: profile?.xp ?? 0, awarded: false };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("xp")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const currentXp = profile?.xp ?? 0;
  const newXp = currentXp + Math.round(bonusXp);
  const { error: updateError } = await supabase.from("users").update({ xp: newXp }).eq("id", userId);
  if (updateError) throw updateError;

  return { newXp, awarded: true };
}

export type ProofUploadInput = {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extensionFromMimeType(mimeType?: string | null): string {
  if (!mimeType) return "bin";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "application/pdf") return "pdf";
  const [, subtype] = mimeType.split("/");
  return subtype ? sanitizeSegment(subtype) : "bin";
}

function buildFileName(taskId: string, input: ProofUploadInput): string {
  if (input.name?.trim()) {
    return `${Date.now()}-${sanitizeSegment(input.name.trim())}`;
  }
  const ext = extensionFromMimeType(input.mimeType);
  return `${Date.now()}-${taskId}.${ext}`;
}

export async function uploadTaskProof(
  supabase: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  bucket: string,
  input: ProofUploadInput,
): Promise<{ proofUrl: string; storagePath: string }> {
  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileData = decode(base64);
  const fileName = buildFileName(taskId, input);
  const storagePath = `${userId}/${taskId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, fileData, {
    contentType: input.mimeType ?? "application/octet-stream",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const proofUrl = data.publicUrl;

  const { error: taskError } = await supabase
    .from("tasks")
    .update({ proof_url: proofUrl })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (taskError) throw taskError;

  return { proofUrl, storagePath };
}
