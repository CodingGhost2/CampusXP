import {
  useCreateTaskMutation,
  useGenerateTasksMutation,
} from "@/hooks/use-campus-queries";
import type { AIDocumentInput } from "@/lib/api/ai";
import { isSupabaseConfigured } from "@/utils/supabase";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
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

const DEFAULT_XP = 20;
const MAX_AI_DOCUMENT_BYTES = 8 * 1024 * 1024;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    if (msg.includes("learning_paths") || msg.includes("Could not find the table 'public.learning_paths'")) {
      return "Database migration missing: run Docs/Supabase-phase6-skill-tree.sql in Supabase SQL editor.";
    }
    return msg;
  }
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage.trim();
  }
  return fallback;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read selected document."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read selected document."));
        return;
      }
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AddTaskScreen() {
  const [title, setTitle] = useState("");
  const [xpInput, setXpInput] = useState(String(DEFAULT_XP));
  const [goal, setGoal] = useState("");
  const [sourceDocument, setSourceDocument] = useState<AIDocumentInput | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string | null>(null);

  const createMut = useCreateTaskMutation();
  const generateMut = useGenerateTasksMutation();
  const isBusy = createMut.isPending || generateMut.isPending;
  const manualLockedByAi = !createMut.isPending && generateMut.isPending;
  const aiLockedByManual = !generateMut.isPending && createMut.isPending;

  async function onManualSubmit() {
    if (isBusy) return;
    setManualError(null);
    setAiError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setManualError("Enter a task title.");
      return;
    }

    const xpParsed = Number.parseInt(xpInput, 10);
    if (Number.isNaN(xpParsed) || xpParsed < 1) {
      setManualError("XP must be a positive number.");
      return;
    }

    try {
      await createMut.mutateAsync({ title: trimmed, xpValue: xpParsed });
      setTitle("");
      setXpInput(String(DEFAULT_XP));
      router.replace("/todo");
    } catch (e) {
      setManualError(getErrorMessage(e, "Could not create task."));
    }
  }

  async function onGenerateWithAI() {
    if (isBusy) return;
    setAiError(null);
    setAiInfo(null);
    setManualError(null);

    const trimmedGoal = goal.trim();
    if (!trimmedGoal && !sourceDocument) {
      setAiError("Describe your goal or attach a document.");
      return;
    }

    try {
      const created = await generateMut.mutateAsync({
        goal: trimmedGoal || undefined,
        sourceDocument: sourceDocument ?? undefined,
      });
      const count = created.length;
      setAiInfo(`AI generated and saved ${count} ${count === 1 ? "task" : "tasks"}.`);
      setGoal("");
      setSourceDocument(null);
      router.replace("/todo");
    } catch (e) {
      setAiError(getErrorMessage(e, "Could not generate tasks."));
    }
  }

  async function onPickSyllabusDocument() {
    if (isBusy) return;
    setAiError(null);
    setAiInfo(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;
      if (typeof file.size === "number" && file.size > MAX_AI_DOCUMENT_BYTES) {
        setAiError("Document too large. Keep it under 8MB for AI generation.");
        return;
      }

      const base64 =
        Platform.OS === "web"
          ? await readFileAsBase64((file as { file?: File }).file ?? (await fetch(file.uri).then((r) => r.blob()).then((b) => new File([b], file.name ?? "document"))))
          : await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
      setSourceDocument({
        name: file.name,
        mimeType: file.mimeType ?? "application/octet-stream",
        base64,
      });
      setAiInfo(`Attached document: ${file.name}`);
    } catch (error) {
      setAiError(getErrorMessage(error, "Could not read selected document."));
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Supabase not configured</Text>
          <Text style={styles.caption}>
            Add env vars and run Docs/Supabase-phase2-schema.sql, then restart Expo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <Text style={styles.headline}>New task</Text>
          <Text style={styles.subtitle}>Create manually or generate from a goal.</Text>

          <Text style={styles.sectionTitle}>Manual</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            onChangeText={setTitle}
            placeholder="e.g. Finish reading chapter 3"
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>XP reward</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setXpInput(value.replace(/[^0-9]/g, ""))}
            placeholder={String(DEFAULT_XP)}
            style={styles.input}
            value={xpInput}
          />
          <Text style={styles.hint}>Default is {DEFAULT_XP} per product spec.</Text>

          {manualError ? <Text style={styles.error}>{manualError}</Text> : null}

          <Pressable
            disabled={isBusy}
            onPress={onManualSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
              isBusy && styles.primaryBtnDisabled,
            ]}
          >
            {createMut.isPending ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryBtnText}>Saving...</Text>
              </View>
            ) : manualLockedByAi ? (
              <Text style={styles.primaryBtnText}>Wait for AI generation...</Text>
            ) : (
              <Text style={styles.primaryBtnText}>Save task</Text>
            )}
          </Pressable>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>AI generate</Text>
          <Text style={styles.hint}>
            Enter a learning goal and/or attach a syllabus document. AI returns structured JSON tasks.
          </Text>

          <Text style={styles.label}>Goal</Text>
          <TextInput
            multiline
            onChangeText={setGoal}
            placeholder="e.g. I want to improve my Python basics this week."
            style={[styles.input, styles.textArea]}
            value={goal}
          />

          <Pressable
            disabled={isBusy}
            onPress={onPickSyllabusDocument}
            style={({ pressed }) => [
              styles.tertiaryBtn,
              pressed && styles.primaryBtnPressed,
              isBusy && styles.primaryBtnDisabled,
            ]}
          >
            <Text style={styles.tertiaryBtnText}>
              {sourceDocument ? "Replace document" : "Attach document"}
            </Text>
          </Pressable>
          {sourceDocument ? (
            <View style={styles.docPill}>
              <Text style={styles.docPillText} numberOfLines={1}>
                {sourceDocument.name ?? "Selected document"}
              </Text>
              <Pressable onPress={() => setSourceDocument(null)}>
                <Text style={styles.docRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : null}

          {aiError ? <Text style={styles.error}>{aiError}</Text> : null}
          {aiInfo ? <Text style={styles.info}>{aiInfo}</Text> : null}

          <Pressable
            disabled={isBusy}
            onPress={onGenerateWithAI}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.primaryBtnPressed,
              isBusy && styles.primaryBtnDisabled,
            ]}
          >
            {generateMut.isPending ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryBtnText}>Generating...</Text>
              </View>
            ) : aiLockedByManual ? (
              <Text style={styles.primaryBtnText}>Wait for manual save...</Text>
            ) : (
              <Text style={styles.primaryBtnText}>Generate tasks with AI</Text>
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
  scroll: {
    padding: 24,
    gap: 8,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  headline: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#ececec",
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.75,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
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
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  error: {
    marginTop: 8,
    color: "#c00",
    fontSize: 14,
  },
  info: {
    marginTop: 8,
    color: "#1b5e20",
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
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "#5c6bc0",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  tertiaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#5c6bc0",
    paddingVertical: 12,
    alignItems: "center",
  },
  tertiaryBtnText: {
    color: "#3949ab",
    fontSize: 15,
    fontWeight: "600",
  },
  docPill: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d0d7ff",
    backgroundColor: "#eef1ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  docPillText: {
    flex: 1,
    color: "#2d3578",
    fontSize: 13,
  },
  docRemove: {
    color: "#5c6bc0",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
