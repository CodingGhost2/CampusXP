import { useProfileQuery, useTasksQuery } from "@/hooks/use-campus-queries";
import { router } from "expo-router";
import {
  ActivityIndicator, 
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const profileQ = useProfileQuery();
  const tasksQ = useTasksQuery();
  const xp = profileQ.data?.xp ?? 0;
  const loading = profileQ.isPending;
  const tasks = tasksQ.data ?? [];
  const completed = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? Math.min(1, completed / tasks.length) : 0;
  const weeklyPoints = Math.max(0, Math.round(xp % 100));
  const suggestions = tasks.slice(0, 2);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topHero}>
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color="#1f2937" />
          </View>
          <View style={styles.welcomeWrap}>
            <Text style={styles.welcome}>Welcome</Text>
            <Text style={styles.role}>Student</Text>
          </View>
          <Text style={styles.logo}>XP</Text>
        </View>

        <View style={styles.searchWrap}>
          <TextInput editable={false} placeholder="Search Topic" placeholderTextColor="#94a3b8" style={styles.searchInput} />
          <Ionicons name="search-outline" size={18} color="#4f63ff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Weekly XP</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(10, progress * 100)}%` }]} />
          </View>
          <Text style={styles.pointsLabel}>{weeklyPoints}pts</Text>
        </View>

        <Text style={styles.sectionTitle}>Tools</Text>
        <View style={styles.toolsGrid}>
          <Pressable style={styles.toolCard} onPress={() => router.push("/add-task")}>
            <Ionicons name="camera-outline" size={32} color="#4f63ff" />
            <Text style={styles.toolLabel}>Scan</Text>
          </Pressable>
          <Pressable style={styles.toolCard} onPress={() => router.push("/todo")}>
            <Ionicons name="document-text-outline" size={32} color="#4f63ff" />
            <Text style={styles.toolLabel}>Grades</Text>
          </Pressable>
          <Pressable style={styles.toolCard} onPress={() => router.push("/profile")}>
            <Ionicons name="settings-outline" size={32} color="#4f63ff" />
            <Text style={styles.toolLabel}>Settings</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Study suggestions</Text>
        {loading ? (
          <ActivityIndicator color="#4f63ff" style={{ marginTop: 8 }} />
        ) : (
          <>
            {suggestions.length === 0 ? (
              <Text style={styles.emptySuggestion}>No suggestions yet. Add tasks from To-Do List.</Text>
            ) : (
              suggestions.map((task, idx) => (
                <Pressable key={task.id} style={styles.suggestionCard} onPress={() => router.push("/todo")}>
                  <Ionicons name={idx % 2 === 0 ? "flask-outline" : "calculator-outline"} size={30} color="#4f63ff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <Text style={styles.suggestionSub}>Module {idx + 1}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#edf0f7" },
  topHero: {
    backgroundColor: "#4f63ff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  heroRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  welcomeWrap: { flex: 1 },
  welcome: { color: "#fff", fontSize: 12, fontWeight: "600" },
  role: { color: "#d7dbff", fontSize: 11 },
  logo: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: 1 },
  searchWrap: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#334155", paddingVertical: 0 },
  content: { padding: 12, paddingBottom: 22 },
  sectionTitle: { fontSize: 17, color: "#1f2937", fontWeight: "700", marginTop: 6, marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  progressTrack: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#e6e9f4",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d7dceb",
  },
  progressFill: { height: "100%", backgroundColor: "#4f63ff" },
  pointsLabel: { marginLeft: 8, color: "#4f63ff", fontWeight: "700", fontSize: 24 },
  toolsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  toolCard: {
    flex: 1,
    marginHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d2d7ee",
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toolLabel: { marginTop: 3, color: "#4f63ff", fontWeight: "700", fontSize: 14 },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dfe3ef",
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  suggestionTitle: { color: "#3d53ee", fontSize: 14, fontWeight: "700", lineHeight: 18 },
  suggestionSub: { color: "#3d53ee", fontSize: 13, fontWeight: "700", marginTop: 1 },
  emptySuggestion: { color: "#64748b", fontSize: 13, marginTop: 4 },
});
