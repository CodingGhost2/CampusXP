import { useProfileQuery, useTasksQuery } from "@/hooks/use-campus-queries";
import { countCompletedTasks } from "@/lib/api/tasks";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/utils/supabase";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const profileQ = useProfileQuery();
  const tasksQ = useTasksQuery();
  const [signingOut, setSigningOut] = useState(false);

  const xp = profileQ.data?.xp ?? null;
  const tasks = tasksQ.data ?? [];
  const completedCount = countCompletedTasks(tasks);
  const loading = profileQ.isPending || tasksQ.isPending;
  const error = profileQ.error ?? tasksQ.error;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.inner}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.caption}>
            Configure Supabase and apply Docs/Supabase-phase2-schema.sql to see stats.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.inner}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Text style={styles.cardValue}>{user?.email ?? "—"}</Text>
        </View>

        {error ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {(error as Error).message ?? "Something went wrong loading profile data."}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total XP</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#0a7ea4" style={styles.inlineLoader} />
          ) : (
            <Text style={styles.cardValueLarge}>{xp ?? 0}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tasks completed</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#0a7ea4" style={styles.inlineLoader} />
          ) : (
            <Text style={styles.cardValueLarge}>{completedCount}</Text>
          )}
          <Text style={styles.cardHint}>Across all tasks in your account.</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel={signingOut ? "Signing out" : "Sign out"}
            disabled={signingOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOut,
              pressed && styles.signOutPressed,
              signingOut && styles.signOutDisabled,
            ]}
          >
            {signingOut ? (
              <View style={styles.signOutBusy}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.signOutText}>Signing out...</Text>
              </View>
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inner: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 4,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fafafa",
    gap: 6,
  },
  banner: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#ffebee",
  },
  bannerText: {
    color: "#b00020",
    fontSize: 14,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: "500",
    color: "#111",
  },
  cardValueLarge: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  inlineLoader: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  cardHint: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  signOut: {
    backgroundColor: "#b00020",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  signOutPressed: {
    opacity: 0.9,
  },
  signOutDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  signOutBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
