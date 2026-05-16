import { TaskRow } from "@/components/TaskRow";
import {
  useAwardQuizBonusMutation,
  useCompleteTaskMutation,
  useDeleteTaskMutation,
  useLearningPathsQuery,
  useProfileQuery,
  useTasksQuery,
  useUploadProofMutation,
} from "@/hooks/use-campus-queries";
import { generateQuizFromContext } from "@/lib/api/quiz";
import { buildQuizFromTaskTitle, type TaskQuiz } from "@/lib/quiz";
import { env } from "@/utils/env";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { TaskRow as Task } from "@/stores/app-store";

const QUIZ_PASS_MIN = 2;
const QUIZ_BONUS_XP = 10;

function deriveQuizTopic(taskTitle: string, learningPathTitle?: string | null): string {
  if (learningPathTitle?.trim()) return learningPathTitle.trim();
  const clean = taskTitle.trim();
  const contextualMatch = clean.match(/\b(?:for|about|on|in)\s+(.+)/i);
  if (contextualMatch?.[1]) return contextualMatch[1].trim();
  return clean;
}

export default function TodoScreen() {
  const profileQ = useProfileQuery();
  const tasksQ = useTasksQuery();
  const learningPathsQ = useLearningPathsQuery();
  const quizBonusMut = useAwardQuizBonusMutation();
  const completeMut = useCompleteTaskMutation();
  const deleteMut = useDeleteTaskMutation();
  const proofMut = useUploadProofMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<TaskQuiz | null>(null);
  const [quizTaskId, setQuizTaskId] = useState<string | null>(null);
  const [quizSelections, setQuizSelections] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizInfo, setQuizInfo] = useState<string | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const quizRequestRef = useRef(0);
  const learningPathTitleById = useMemo(() => {
    const map = new Map<string, string>();
    (learningPathsQ.data ?? []).forEach((path) => {
      if (path.id && path.title?.trim()) {
        map.set(path.id, path.title.trim());
      }
    });
    return map;
  }, [learningPathsQ.data]);

  const onComplete = useCallback(
    async (taskId: string) => {
      if (completeMut.isPending) return;
      setActionError(null);
      try {
        await completeMut.mutateAsync(taskId);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not complete task.");
      }
    },
    [completeMut],
  );

  const onPickImageProof = useCallback(
    async (taskId: string) => {
      if (proofMut.isPending) return;
      setActionError(null);
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error("Media library permission is required to upload image proof.");
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });

        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        await proofMut.mutateAsync({
          taskId,
          file: {
            uri: asset.uri,
            mimeType: asset.mimeType,
            name: asset.fileName,
          },
        });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not upload image proof.");
      }
    },
    [proofMut],
  );

  const onPickDocumentProof = useCallback(
    async (taskId: string) => {
      if (proofMut.isPending) return;
      setActionError(null);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        await proofMut.mutateAsync({
          taskId,
          file: {
            uri: asset.uri,
            mimeType: asset.mimeType,
            name: asset.name,
          },
        });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not upload document proof.");
      }
    },
    [proofMut],
  );

  const onOpenQuiz = useCallback(async (task: Task) => {
    const requestId = quizRequestRef.current + 1;
    quizRequestRef.current = requestId;
    setQuizLoading(true);
    setQuiz(null);
    setQuizTaskId(task.id);
    setQuizSelections([]);
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizError(null);
    setQuizInfo(null);

    try {
      let nextQuiz: TaskQuiz | null = null;
      let quizFallbackInfo: string | null = null;
      const quizTopic = deriveQuizTopic(task.title, task.learning_path_id ? learningPathTitleById.get(task.learning_path_id) : null);
      if (env.aiGatewayUrl) {
        try {
          const result = await generateQuizFromContext(env.aiGatewayUrl, {
            taskTitle: quizTopic,
            proofUrl: task.proof_url,
          });
          nextQuiz = result.quiz;
          if (result.fallbackReason) {
            quizFallbackInfo = "AI quiz generation failed, so backup quiz questions are shown for this task.";
          }
        } catch {
          // Fall back to local quiz generation if quiz mode is unavailable.
        }
      }

      if (!nextQuiz) {
        nextQuiz = buildQuizFromTaskTitle(quizTopic);
        quizFallbackInfo = "AI quiz service was unavailable, so local backup quiz questions are shown.";
      }

      if (quizRequestRef.current !== requestId) return;
      setQuiz(nextQuiz);
      setQuizSelections(Array(nextQuiz.questions.length).fill(-1));
      if (quizFallbackInfo) {
        setQuizInfo(quizFallbackInfo);
      }
    } finally {
      if (quizRequestRef.current === requestId) {
        setQuizLoading(false);
      }
    }
  }, [learningPathTitleById]);

  const onDeleteTask = useCallback(
    async (task: Task) => {
      if (deleteMut.isPending) return;
      setActionError(null);

      const runDelete = async () => {
        try {
          await deleteMut.mutateAsync(task.id);
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "Could not delete task.");
        }
      };

      if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
        const ok = globalThis.confirm(`Delete "${task.title}"? This action cannot be undone.`);
        if (ok) void runDelete();
        return;
      }

      Alert.alert("Delete task", `Delete "${task.title}"? This action cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void runDelete() },
      ]);
    },
    [deleteMut],
  );

  const onCloseQuiz = useCallback(() => {
    quizRequestRef.current += 1;
    setQuizLoading(false);
    setQuiz(null);
    setQuizTaskId(null);
    setQuizSelections([]);
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizError(null);
    setQuizInfo(null);
  }, []);

  const onSelectOption = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (quizSubmitted) return;
      setQuizSelections((prev) => {
        const next = [...prev];
        next[questionIndex] = optionIndex;
        return next;
      });
    },
    [quizSubmitted],
  );

  const onSubmitQuiz = useCallback(async () => {
    if (!quiz || quizSubmitted) return;
    setQuizError(null);
    setQuizInfo(null);

    const hasMissing = quizSelections.some((value) => value < 0);
    if (hasMissing) {
      setQuizError("Answer all questions before submitting.");
      return;
    }

    const score = quiz.questions.reduce((sum, q, idx) => {
      return sum + (quizSelections[idx] === q.correctIndex ? 1 : 0);
    }, 0);
    setQuizSubmitted(true);
    setQuizScore(score);

    if (score < QUIZ_PASS_MIN) {
      setQuizInfo(`Score ${score}/${quiz.questions.length}. Score at least ${QUIZ_PASS_MIN} to earn bonus XP.`);
      return;
    }
    if (!quizTaskId) {
      setQuizError("Missing task context for quiz reward.");
      return;
    }

    try {
      const result = await quizBonusMut.mutateAsync({ bonusXp: QUIZ_BONUS_XP, taskId: quizTaskId });
      if (result.awarded) {
        setQuizInfo(`Great work! +${QUIZ_BONUS_XP} XP awarded for passing this quiz.`);
      } else {
        setQuizInfo(`Score ${score}/${quiz.questions.length}. Bonus already claimed for this task.`);
      }
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : "Could not award quiz bonus XP.");
    }
  }, [quiz, quizBonusMut, quizSelections, quizSubmitted, quizTaskId]);

  const renderItem: ListRenderItem<Task> = useCallback(
    ({ item }) => (
      <TaskRow
        completeDisabled={completeMut.isPending}
        proofDisabled={proofMut.isPending}
        deleteDisabled={deleteMut.isPending}
        task={item}
        onComplete={onComplete}
        onOpenQuiz={onOpenQuiz}
        onPickImageProof={onPickImageProof}
        onPickDocumentProof={onPickDocumentProof}
        onDelete={() => onDeleteTask(item)}
      />
    ),
    [
      completeMut.isPending,
      deleteMut.isPending,
      onComplete,
      onDeleteTask,
      onOpenQuiz,
      onPickDocumentProof,
      onPickImageProof,
      proofMut.isPending,
    ],
  );

  const loading = profileQ.isPending || tasksQ.isPending;
  const tasks = tasksQ.data ?? [];
  const error = actionError ?? profileQ.error ?? tasksQ.error;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>To-Do List</Text>
          <Text style={styles.caption}>Complete tasks, upload proof, and earn XP.</Text>
        </View>
        <Pressable onPress={() => router.push("/add-task")} style={styles.addBtn}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{(error as Error).message ?? "Something went wrong."}</Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={tasks}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>No tasks yet. Tap Add to create your first task.</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={tasksQ.isFetching && !tasksQ.isPending}
            onRefresh={() => {
              setActionError(null);
              void Promise.all([tasksQ.refetch(), profileQ.refetch()]);
            }}
          />
        }
        renderItem={renderItem}
      />

      <Modal
        animationType="slide"
        transparent
        visible={quizLoading || Boolean(quiz)}
        onRequestClose={onCloseQuiz}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{quiz?.title ?? "Loading quiz..."}</Text>
              <Pressable accessibilityLabel="Close quiz" onPress={onCloseQuiz} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {quizLoading ? (
                <View style={styles.quizLoadingWrap}>
                  <ActivityIndicator color="#4f63ff" />
                  <Text style={styles.quizLoadingText}>Generating quiz questions...</Text>
                </View>
              ) : null}
              {quiz?.questions.map((q, index) => (
                <View key={`${q.prompt}-${index}`} style={styles.questionBlock}>
                  <Text style={styles.questionPrompt}>
                    {index + 1}. {q.prompt}
                  </Text>
                  {q.options.map((option, optionIndex) => (
                    <Pressable
                      key={`${option}-${optionIndex}`}
                      disabled={quizSubmitted}
                      onPress={() => onSelectOption(index, optionIndex)}
                      style={[
                        styles.optionPill,
                        quizSelections[index] === optionIndex && styles.optionPillSelected,
                      ]}
                    >
                      <Text style={styles.optionText}>{option}</Text>
                    </Pressable>
                  ))}
                  {quizSubmitted ? <Text style={styles.explanation}>Why: {q.explanation}</Text> : null}
                </View>
              ))}
              {quizError ? <Text style={styles.quizError}>{quizError}</Text> : null}
              {quizInfo ? <Text style={styles.quizInfo}>{quizInfo}</Text> : null}
              {quizSubmitted && quizScore !== null ? (
                <Text style={styles.quizInfo}>Score: {quizScore}/{quiz?.questions.length ?? 0}</Text>
              ) : null}
              {!quizSubmitted ? (
                <Pressable onPress={onSubmitQuiz} style={styles.submitBtn}>
                  <Text style={styles.submitText}>Submit answers</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onCloseQuiz} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>{quizSubmitted ? "Done" : "Close quiz"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f4f8" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  caption: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  addBtn: {
    backgroundColor: "#4f63ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  bannerText: { color: "#b91c1c", fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1, backgroundColor: "#fff" },
  empty: { marginTop: 28, textAlign: "center", color: "#6b7280" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, maxHeight: "88%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
  },
  modalCloseBtnText: {
    color: "#3949ab",
    fontWeight: "700",
    fontSize: 12,
  },
  modalScroll: {
    marginTop: 8,
  },
  modalScrollContent: {
    paddingBottom: 6,
  },
  quizLoadingWrap: {
    marginTop: 16,
    alignItems: "center",
    gap: 8,
  },
  quizLoadingText: {
    color: "#374151",
    fontSize: 13,
  },
  questionBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ececec",
    gap: 6,
  },
  questionPrompt: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  optionPill: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d3d8e2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  optionPillSelected: { borderColor: "#4f63ff", backgroundColor: "#eef1ff" },
  optionText: { fontSize: 12.5, color: "#374151" },
  explanation: { marginTop: 2, fontSize: 12, color: "#4b5563" },
  quizError: { marginTop: 8, color: "#b91c1c", fontSize: 12 },
  quizInfo: { marginTop: 8, color: "#166534", fontSize: 12 },
  submitBtn: {
    marginTop: 12,
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "600" },
  closeBtn: {
    marginTop: 10,
    backgroundColor: "#4f63ff",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  closeBtnText: { color: "#fff", fontWeight: "600" },
});
