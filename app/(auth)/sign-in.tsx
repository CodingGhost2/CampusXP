import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Mode = "signin" | "signup";

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  async function onSubmit() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter email and password.");
      return;
    }

    const client = getSupabase();
    if (!client) {
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (signInError) setError(signInError.message);
      } else {
        const { error: signUpError } = await client.auth.signUp({
          email: trimmed,
          password,
        });
        if (signUpError) setError(signUpError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Configure Supabase</Text>
          <Text style={styles.caption}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your
            .env (see .env.example), then restart Expo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.headline}>Campus XP</Text>
          <Text style={styles.subtitle}>
            {mode === "signin" ? "Sign in to continue" : "Create an account"}
          </Text>

          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                setMode("signin");
                setError(null);
              }}
              style={[styles.segmentBtn, mode === "signin" && styles.segmentBtnActive]}
            >
              <Text
                style={[styles.segmentLabel, mode === "signin" && styles.segmentLabelActive]}
              >
                Sign in
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("signup");
                setError(null);
              }}
              style={[styles.segmentBtn, mode === "signup" && styles.segmentBtnActive]}
            >
              <Text
                style={[styles.segmentLabel, mode === "signup" && styles.segmentLabelActive]}
              >
                Sign up
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@school.edu"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={loading}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
              loading && styles.primaryBtnDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 8,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  headline: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.75,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  segment: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
  },
  segmentLabelActive: {
    color: "#0a7ea4",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  error: {
    marginTop: 8,
    color: "#c00",
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
