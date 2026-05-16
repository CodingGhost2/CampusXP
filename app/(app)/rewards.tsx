import {
  useLearningPathsQuery,
  useProfileQuery,
  useSkillProgressQuery,
} from "@/hooks/use-campus-queries";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RewardsScreen() {
  const profileQ = useProfileQuery();
  const pathsQ = useLearningPathsQuery();
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const selectedPath = useMemo(() => {
    const paths = pathsQ.data ?? [];
    if (paths.length === 0) return null;
    return paths.find((path) => path.id === selectedPathId) ?? paths[0];
  }, [pathsQ.data, selectedPathId]);
  const progressQ = useSkillProgressQuery(selectedPath?.id ?? null);

  const xp = profileQ.data?.xp ?? 0;
  const progress = progressQ.data ?? [];
  const currentIdx = progress.findIndex((row) => row.earnedXp < row.skill.unlock_xp);
  const activeIndex = currentIdx === -1 ? Math.max(0, progress.length - 1) : currentIdx;
  const previous = activeIndex > 0 ? progress[activeIndex - 1] : null;
  const current = progress[activeIndex] ?? null;
  const next = activeIndex < progress.length - 1 ? progress[activeIndex + 1] : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Text style={styles.title}>Skill Check</Text>
      <Text style={styles.subtitle}>Gamified progress across each uploaded learning path.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total XP</Text>
        <Text style={styles.cardValue}>{xp} pts</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pathRow}
      >
        {(pathsQ.data ?? []).map((path) => {
          const selected = selectedPath?.id === path.id;
          return (
            <Pressable
              key={path.id}
              onPress={() => setSelectedPathId(path.id)}
              style={[styles.pathPill, selected && styles.pathPillSelected]}
            >
              <Text style={[styles.pathPillText, selected && styles.pathPillTextSelected]}>
                {path.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!selectedPath ? (
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>No learning path yet</Text>
          <Text style={styles.tipText}>
            Generate tasks from a goal or document to auto-create a skill tree.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.tree}>
          <Text style={styles.treeTitle}>{selectedPath.title}</Text>
          {progress.map((row, index) => {
            const unlocked = row.earnedXp >= row.skill.unlock_xp;
            const isCurrent = current?.skill.id === row.skill.id;
            return (
              <View key={row.skill.id} style={styles.nodeWrap}>
                {index > 0 ? <View style={styles.link} /> : null}
                <View style={[styles.node, unlocked && styles.nodeUnlocked, isCurrent && styles.nodeCurrent]}>
                  <Text style={styles.nodeTitle}>{row.skill.name}</Text>
                  <Text style={styles.nodeMeta}>
                    {row.earnedXp}/{row.skill.unlock_xp} XP · {row.completedTasks} tasks
                  </Text>
                  <Text style={styles.nodeDesc}>{row.skill.description}</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Progress lane</Text>
            <Text style={styles.tipText}>Previous: {previous?.skill.name ?? "—"}</Text>
            <Text style={styles.tipText}>Current: {current?.skill.name ?? "—"}</Text>
            <Text style={styles.tipText}>Next: {next?.skill.name ?? "—"}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#edf0f7", padding: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, color: "#6b7280", marginBottom: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dfe3ef",
    padding: 14,
    marginBottom: 10,
  },
  cardLabel: { color: "#6b7280", fontSize: 13 },
  cardValue: { color: "#4f63ff", fontSize: 24, fontWeight: "700", marginTop: 2 },
  pathRow: {
    gap: 8,
    paddingBottom: 8,
  },
  pathPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe3ef",
  },
  pathPillSelected: {
    backgroundColor: "#4f63ff",
    borderColor: "#4f63ff",
  },
  pathPillText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
  },
  pathPillTextSelected: {
    color: "#fff",
  },
  tree: {
    paddingBottom: 20,
  },
  treeTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    marginVertical: 8,
  },
  nodeWrap: {
    alignItems: "center",
  },
  link: {
    width: 3,
    height: 18,
    borderRadius: 8,
    backgroundColor: "#c7d2fe",
  },
  node: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    padding: 12,
  },
  nodeUnlocked: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  nodeCurrent: {
    borderColor: "#818cf8",
    backgroundColor: "#eef2ff",
  },
  nodeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  nodeMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#4338ca",
  },
  nodeDesc: {
    marginTop: 6,
    fontSize: 12,
    color: "#4b5563",
  },
  tipBox: {
    marginTop: 8,
    backgroundColor: "#eef1ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d2d8ff",
    padding: 12,
  },
  tipTitle: { color: "#303f9f", fontWeight: "700", marginBottom: 4 },
  tipText: { color: "#374151", lineHeight: 20 },
});
