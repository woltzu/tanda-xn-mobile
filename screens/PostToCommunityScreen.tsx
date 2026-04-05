import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useCommunityPosts, PostType } from "../hooks/useCommunityFeatures";

const POST_TYPES: { key: PostType; icon: string; color: string; label: string; prompt: string }[] = [
  {
    key: "milestone",
    icon: "trophy",
    color: "#00C6AE",
    label: "Milestone",
    prompt: "Share a moment that matters. What did this achievement mean to you and your family?",
  },
  {
    key: "question",
    icon: "help-circle",
    color: "#3B82F6",
    label: "Question",
    prompt: "Be specific about what you need. The more detail, the better the community can help.",
  },
  {
    key: "welcome",
    icon: "hand-right",
    color: "#F59E0B",
    label: "Welcome",
    prompt: "Your name will be attached to this welcome. Share something that would have helped you when you first arrived.",
  },
  {
    key: "service_announcement",
    icon: "megaphone",
    color: "#8B5CF6",
    label: "Announcement",
    prompt: "Share your achievement or news. Not an ad — a story about your journey.",
  },
];

export default function PostToCommunityScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const communityId = (route.params as any)?.communityId ?? "";
  const { user } = useAuth();
  const { createPost } = useCommunityPosts(communityId);

  const [postType, setPostType] = useState<PostType>("milestone");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedType = POST_TYPES.find(t => t.key === postType) ?? POST_TYPES[0];

  const handlePost = async () => {
    if (!body.trim()) {
      Alert.alert("Required", "Please write something to share");
      return;
    }

    setSubmitting(true);
    try {
      await createPost({
        communityId,
        postType,
        title: title.trim() || undefined,
        body: body.trim(),
        authorFirstName: user?.user_metadata?.first_name ?? "Member",
        authorOrigin: user?.user_metadata?.origin_country,
      });
      Alert.alert("Posted!", "Your post is now visible to the community.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post to Community</Text>
          <TouchableOpacity
            style={[styles.postButton, (!body.trim() || submitting) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!body.trim() || submitting}
          >
            <Text style={styles.postButtonText}>{submitting ? "..." : "Post"}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Post Type Selection */}
          <Text style={styles.sectionLabel}>What are you sharing?</Text>
          <View style={styles.typeGrid}>
            {POST_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeCard,
                  postType === t.key && { borderColor: t.color, backgroundColor: t.color + "10" },
                ]}
                onPress={() => setPostType(t.key)}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.color + "20" }]}>
                  <Ionicons name={t.icon as any} size={22} color={t.color} />
                </View>
                <Text style={[styles.typeLabel, postType === t.key && { color: t.color }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Guided Prompt */}
          <View style={[styles.promptCard, { borderLeftColor: selectedType.color }]}>
            <Ionicons name="bulb-outline" size={16} color={selectedType.color} />
            <Text style={styles.promptText}>{selectedType.prompt}</Text>
          </View>

          {/* Title (optional) */}
          <TextInput
            style={styles.titleInput}
            placeholder="Title (optional)"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Body */}
          <TextInput
            style={styles.bodyInput}
            placeholder="Write your post..."
            placeholderTextColor="#9CA3AF"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />

          {/* Character count */}
          <Text style={styles.charCount}>{body.length}/2000</Text>

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              Your post will be visible to all members of this community. Your first name will be shown as the author.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  postButton: { backgroundColor: "#00C6AE", paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  content: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 17, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  typeGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  typeCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center" },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  typeLabel: { fontSize: 11, fontWeight: "600", color: "#0A2342" },
  promptCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 3 },
  promptText: { flex: 1, fontSize: 13, color: "#6B7280", lineHeight: 18 },
  titleInput: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 17, fontWeight: "600", color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  bodyInput: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 15, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", minHeight: 160 },
  charCount: { fontSize: 12, color: "#9CA3AF", textAlign: "right", marginTop: 4, marginBottom: 16 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F5F7FA", borderRadius: 12, padding: 14 },
  infoText: { flex: 1, fontSize: 13, color: "#6B7280", lineHeight: 18 },
});
