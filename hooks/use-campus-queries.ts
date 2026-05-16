import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { generateTasksFromGoal, type GenerateTasksInput } from "@/lib/api/ai";
import {
  buildSkillNodesFromGeneratedTasks,
  createLearningPath,
  createSkillsForPath,
  fetchLearningPathsForUser,
  fetchSkillProgressForPath,
  type SkillProgressRow,
} from "@/lib/api/learning-paths";
import {
  awardQuizBonusXp,
  completeTask,
  createTask,
  createTasksBulk,
  deleteTask,
  fetchTasksForUser,
  uploadTaskProof,
  type CreateTaskInput,
  type ProofUploadInput,
} from "@/lib/api/tasks";
import { ensureUserProfile, fetchProfile } from "@/lib/api/profile";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";
import { env } from "@/utils/env";
import { getSupabase } from "@/utils/supabase";

export function useProfileQuery() {
  const { user } = useAuth();
  const supabase = getSupabase();

  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchProfile(supabase!, user!.id),
    enabled: Boolean(user && supabase),
  });
}

export function useTasksQuery() {
  const { user } = useAuth();
  const supabase = getSupabase();

  return useQuery({
    queryKey: queryKeys.tasks(user?.id ?? ""),
    queryFn: () => fetchTasksForUser(supabase!, user!.id),
    enabled: Boolean(user && supabase),
  });
}

/** Keeps Zustand in sync with TanStack Query results (AP state structure). */
export function useAppStoreSync() {
  const profileQ = useProfileQuery();
  const tasksQ = useTasksQuery();
  const setXp = useAppStore((s) => s.setXp);
  const setTasks = useAppStore((s) => s.setTasks);
  const setLoading = useAppStore((s) => s.setLoading);

  useEffect(() => {
    setLoading({
      profile: profileQ.isPending,
      tasks: tasksQ.isPending,
    });
  }, [profileQ.isPending, tasksQ.isPending, setLoading]);

  useEffect(() => {
    if (profileQ.data) setXp(profileQ.data.xp);
  }, [profileQ.data, setXp]);

  useEffect(() => {
    if (tasksQ.data) setTasks(tasksQ.data);
  }, [tasksQ.data, setTasks]);
}

export function useEnsureProfileEffect() {
  const { user, initialized } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!initialized || !user || !supabase) return;

    let cancelled = false;

    ensureUserProfile(supabase, user)
      .then(() => {
        if (!cancelled) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
        }
      })
      .catch(() => {
        /* Surface via query errors if profile fetch fails */
      });

    return () => {
      cancelled = true;
    };
  }, [initialized, queryClient, supabase, user]);
}

export function useResetAppStoreOnSignOut() {
  const { user } = useAuth();
  const reset = useAppStore((s) => s.reset);

  useEffect(() => {
    if (!user) reset();
  }, [user, reset]);
}

export function useCompleteTaskMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => {
      if (!user || !supabase) throw new Error("Not signed in");
      return completeTask(supabase, user.id, taskId);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
    },
  });
}

export function useCreateTaskMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => {
      if (!user || !supabase) throw new Error("Not signed in");
      return createTask(supabase, user.id, input);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
    },
  });
}

export function useDeleteTaskMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => {
      if (!user || !supabase) throw new Error("Not signed in");
      return deleteTask(supabase, user.id, taskId);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
    },
  });
}

export function useGenerateTasksMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateTasksInput) => {
      if (!user || !supabase) throw new Error("Not signed in");
      if (!env.aiGatewayUrl) {
        throw new Error("Set EXPO_PUBLIC_AI_GATEWAY_URL to enable AI task generation.");
      }

      const generated = await generateTasksFromGoal(env.aiGatewayUrl, input);
      const learningPathTitle =
        input.sourceDocument?.name ??
        input.goal?.trim() ??
        `Learning path ${new Date().toISOString().slice(0, 10)}`;
      const learningPath = await createLearningPath(supabase, user.id, {
        title: learningPathTitle,
        sourceName: input.sourceDocument?.name ?? null,
        sourceKind: input.sourceDocument ? "document" : "goal",
      });

      const aiSkills =
        generated.skills.length > 0
          ? generated.skills.map((skill) => ({
              name: skill.name,
              description: skill.description,
              orderIndex: skill.orderIndex,
              unlockXp: skill.unlockXp,
            }))
          : buildSkillNodesFromGeneratedTasks(generated.tasks);
      const skills = await createSkillsForPath(supabase, user.id, learningPath.id, aiSkills);
      const skillIdByKey = new Map<string, string>();
      generated.skills.forEach((skill, index) => {
        const created = skills[index];
        if (created) skillIdByKey.set(skill.key, created.id);
      });

      const enrichedTasks = generated.tasks.map((task, index) => {
        const mappedSkillId = generated.taskSkillKeys[index]
          ? skillIdByKey.get(generated.taskSkillKeys[index]!)
          : undefined;
        return {
        ...task,
        learningPathId: learningPath.id,
          skillId: mappedSkillId ?? (skills.length > 0 ? skills[index % skills.length]?.id ?? null : null),
        };
      });
      return createTasksBulk(supabase, user.id, enrichedTasks);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths(user.id) });
    },
  });
}

export function useLearningPathsQuery() {
  const { user } = useAuth();
  const supabase = getSupabase();

  return useQuery({
    queryKey: queryKeys.learningPaths(user?.id ?? ""),
    queryFn: () => fetchLearningPathsForUser(supabase!, user!.id),
    enabled: Boolean(user && supabase),
  });
}

export function useSkillProgressQuery(pathId: string | null) {
  const { user } = useAuth();
  const supabase = getSupabase();

  return useQuery<SkillProgressRow[]>({
    queryKey: queryKeys.skillProgress(pathId ?? ""),
    queryFn: () => fetchSkillProgressForPath(supabase!, user!.id, pathId!),
    enabled: Boolean(user && supabase && pathId),
  });
}

export type UploadProofMutationInput = {
  taskId: string;
  file: ProofUploadInput;
};

export type AwardQuizBonusInput = {
  bonusXp: number;
  taskId: string;
};

export function useUploadProofMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, file }: UploadProofMutationInput) => {
      if (!user || !supabase) throw new Error("Not signed in");
      return uploadTaskProof(supabase, user.id, taskId, env.storageBucket, file);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
    },
  });
}

export function useAwardQuizBonusMutation() {
  const { user } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bonusXp, taskId }: AwardQuizBonusInput) => {
      if (!user || !supabase) throw new Error("Not signed in");
      return awardQuizBonusXp(supabase, user.id, taskId, bonusXp);
    },
    onSuccess: () => {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
    },
  });
}
