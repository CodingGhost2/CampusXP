import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { TaskRow as Task } from "@/stores/app-store";

type Props = {
  task: Task;
  completeDisabled?: boolean;
  proofDisabled?: boolean;
  deleteDisabled?: boolean;
  onComplete: (taskId: string) => void;
  onPickImageProof: (taskId: string) => void;
  onPickDocumentProof: (taskId: string) => void;
  onOpenQuiz: (task: Task) => void;
  onDelete: (taskId: string) => void;
};

export function TaskRow({
  task,
  completeDisabled,
  proofDisabled,
  deleteDisabled,
  onComplete,
  onPickImageProof,
  onPickDocumentProof,
  onOpenQuiz,
  onDelete,
}: Props) {
  return (
    <View style={[styles.row, task.completed && styles.rowDone]}>
      <Pressable
        accessibilityLabel={`Open quiz for ${task.title}`}
        accessibilityRole="button"
        onPress={() => onOpenQuiz(task)}
        style={({ pressed }) => [styles.rowText, pressed && styles.completeBtnPressed]}
      >
        <Text style={[styles.title, task.completed && styles.titleDone]}>{task.title}</Text>
        <Text style={styles.meta}>{task.completed ? "Completed" : `${task.xp_value} XP`}</Text>
        {task.proof_url ? <Text style={styles.proofMeta}>Proof uploaded</Text> : null}
        <Text style={styles.quizLink}>Take quick quiz</Text>
      </Pressable>

      <View style={styles.actions}>
        {!task.completed ? (
          <Pressable
            accessibilityLabel="Mark complete"
            accessibilityRole="button"
            disabled={completeDisabled}
            hitSlop={8}
            onPress={() => onComplete(task.id)}
            style={({ pressed }) => [styles.completeBtn, pressed && styles.completeBtnPressed]}
          >
            {completeDisabled ? (
              <ActivityIndicator size="small" color="#0a7ea4" />
            ) : (
              <Ionicons name="ellipse-outline" size={28} color="#0a7ea4" />
            )}
          </Pressable>
        ) : (
          <Ionicons name="checkmark-circle" size={28} color="#2e7d32" accessibilityLabel="Completed" />
        )}

        <Pressable
          accessibilityLabel="Attach image proof"
          accessibilityRole="button"
          disabled={proofDisabled}
          hitSlop={8}
          onPress={() => onPickImageProof(task.id)}
          style={({ pressed }) => [styles.proofBtn, pressed && styles.completeBtnPressed]}
        >
          {proofDisabled ? (
            <ActivityIndicator size="small" color="#5c6bc0" />
          ) : (
            <Ionicons name="image-outline" size={22} color="#5c6bc0" />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Attach document proof"
          accessibilityRole="button"
          disabled={proofDisabled}
          hitSlop={8}
          onPress={() => onPickDocumentProof(task.id)}
          style={({ pressed }) => [styles.proofBtn, pressed && styles.completeBtnPressed]}
        >
          {proofDisabled ? (
            <ActivityIndicator size="small" color="#5c6bc0" />
          ) : (
            <Ionicons name="document-outline" size={22} color="#5c6bc0" />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="Delete task"
          accessibilityRole="button"
          disabled={deleteDisabled}
          hitSlop={8}
          onPress={() => onDelete(task.id)}
          style={({ pressed }) => [styles.proofBtn, pressed && styles.completeBtnPressed]}
        >
          {deleteDisabled ? (
            <ActivityIndicator size="small" color="#c62828" />
          ) : (
            <Ionicons name="trash-outline" size={22} color="#c62828" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
    gap: 12,
  },
  rowDone: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111",
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: "#666",
    fontWeight: "500",
  },
  meta: {
    fontSize: 14,
    color: "#666",
  },
  proofMeta: {
    fontSize: 12,
    color: "#2e7d32",
  },
  quizLink: {
    fontSize: 12,
    color: "#3949ab",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  completeBtn: {
    padding: 4,
  },
  proofBtn: {
    padding: 6,
  },
  completeBtnPressed: {
    opacity: 0.7,
  },
});
