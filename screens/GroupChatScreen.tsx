// ══════════════════════════════════════════════════════════════════════════════
// GroupChatScreen — real-time per-circle chat (Phase 1)
// Reads up to the latest 50 messages on mount and subscribes to the
// circle_messages:<circleId> realtime channel for live INSERT events.
// Members of the circle (per RLS) can read; only the authenticated user
// can INSERT messages with their own user_id and message_type='user'.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type NavProp = StackNavigationProp<RootStackParamList, "GroupChat">;
type RouteParams = RouteProp<RootStackParamList, "GroupChat">;

interface ChatMessage {
  id: string;
  circle_id: string;
  user_id: string;
  body: string;
  message_type: "user" | "system";
  created_at: string;
  sender_name: string | null;
  sender_avatar: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function GroupChatScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const circleId = route.params?.circleId ?? "";
  const circleName = route.params?.circleName ?? "Circle";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Initial load: auth + last 50 messages ──────────────────────────────────
  useEffect(() => {
    if (!circleId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getUser();
        if (cancelled) return;
        setCurrentUserId(sessionData?.user?.id ?? null);

        console.log("[GroupChat] loading last 50 messages", { circleId });
        const { data, error } = await supabase
          .from("circle_messages")
          .select(
            "id, circle_id, user_id, body, message_type, created_at, profiles!circle_messages_user_id_fkey(full_name, avatar_url)"
          )
          .eq("circle_id", circleId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (error) {
          console.error("[GroupChat] initial load failed", error);
        } else if (data) {
          // Flatten the joined profile into sender_name / sender_avatar
          const flat: ChatMessage[] = data.map((row: any) => ({
            id: row.id,
            circle_id: row.circle_id,
            user_id: row.user_id,
            body: row.body,
            message_type: row.message_type,
            created_at: row.created_at,
            sender_name: row.profiles?.full_name ?? null,
            sender_avatar: row.profiles?.avatar_url ?? null,
          }));
          setMessages(flat);
        }
      } catch (err) {
        console.error("[GroupChat] mount error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [circleId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!circleId) return;

    console.log("[GroupChat] subscribing to realtime channel", { circleId });
    const channel = supabase
      .channel(`circle_messages:${circleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_messages",
          filter: `circle_id=eq.${circleId}`,
        },
        async (payload: any) => {
          const newMsg = payload.new;
          if (!newMsg?.id) return;
          console.log("[GroupChat] realtime INSERT received", { id: newMsg.id });

          // Optimistically push the row with a temporary "Loading…" sender
          // label, deduping by id so resubscribes / sender-echo don't double up.
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const stub: ChatMessage = {
              id: newMsg.id,
              circle_id: newMsg.circle_id,
              user_id: newMsg.user_id,
              body: newMsg.body,
              message_type: newMsg.message_type,
              created_at: newMsg.created_at,
              sender_name: "Loading…",
              sender_avatar: null,
            };
            return [stub, ...prev];
          });

          // Fetch the sender's profile and patch the message in place.
          // Realtime payloads don't include FK joins, so this is a separate hop.
          const { data: profile, error: profErr } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", newMsg.user_id)
            .maybeSingle();
          if (profErr) {
            console.warn("[GroupChat] profile lookup failed", profErr);
            return;
          }
          if (profile) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === newMsg.id
                  ? {
                      ...m,
                      sender_name: profile.full_name ?? "Member",
                      sender_avatar: profile.avatar_url ?? null,
                    }
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      console.log("[GroupChat] removing realtime channel");
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending || !currentUserId) return;
    setSending(true);
    console.log("[GroupChat] sending", { circleId, length: trimmed.length });

    const { error } = await supabase.from("circle_messages").insert({
      circle_id: circleId,
      user_id: currentUserId,
      body: trimmed,
      message_type: "user",
    });

    if (error) {
      console.error("[GroupChat] send failed", error);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(`Could not send: ${error.message}`);
      } else {
        Alert.alert("Could not send", error.message || "Please try again");
      }
    } else {
      setInputText("");
      // Don't optimistically add — let realtime deliver it (avoids dedupe edge cases)
    }
    setSending(false);
  };

  // ── Render: single message row ─────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.user_id === currentUserId;
    const isSystem = item.message_type === "system";

    if (isSystem) {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{item.body}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, { alignItems: isOwn ? "flex-end" : "flex-start" }]}>
        {!isOwn && (
          <Text style={styles.senderName}>{item.sender_name || "Member"}</Text>
        )}
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
          ]}
        >
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {item.body}
          </Text>
        </View>
        <Text style={styles.timestamp}>{formatMessageTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {circleName}
          </Text>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.fillCenter}>
            <ActivityIndicator size="large" color="#00C6AE" />
          </View>
        ) : messages.length === 0 ? (
          <View style={[styles.fillCenter, { padding: 32 }]}>
            <Text style={styles.emptyText}>
              No messages yet.{"\n"}Be the first to say hello!
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendBtn,
              (!inputText.trim() || sending) && styles.sendBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F9FC" },
  header: {
    backgroundColor: "#0A2342",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBack: { padding: 4 },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  fillCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 16, lineHeight: 22 },
  listContent: { padding: 12 },
  messageRow: { marginVertical: 4 },
  senderName: {
    fontSize: 11,
    color: "#64748B",
    marginLeft: 12,
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "78%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: { backgroundColor: "#00C6AE" },
  bubbleOther: { backgroundColor: "#FFFFFF" },
  bubbleText: { fontSize: 15 },
  bubbleTextOwn: { color: "#FFFFFF" },
  bubbleTextOther: { color: "#0A2342" },
  timestamp: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
    marginHorizontal: 12,
  },
  systemRow: { alignItems: "center", marginVertical: 8 },
  systemText: {
    color: "#64748B",
    fontStyle: "italic",
    fontSize: 12,
    textAlign: "center",
  },
  inputBar: {
    flexDirection: "row",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    maxHeight: 120,
    fontSize: 15,
    color: "#0A2342",
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#00C6AE",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#94A3B8" },
});
