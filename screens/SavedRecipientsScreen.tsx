import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type SavedRecipientsNavigationProp = StackNavigationProp<RootStackParamList>;

type Recipient = {
  id: string;
  name: string;
  nickname?: string;
  country: string;
  flag: string;
  phone: string;
  provider: string;
  lastSent?: string;
  totalSent: number;
  isFavorite: boolean;
};

// Mock data - In production, this would come from context/storage
const mockRecipients: Recipient[] = [
  {
    id: "r1",
    name: "Mama Kengne",
    nickname: "Mama",
    country: "Cameroon",
    flag: "🇨🇲",
    phone: "+237 6XX XXX XXX",
    provider: "MTN Mobile Money",
    lastSent: "Dec 29, 2025",
    totalSent: 1200,
    isFavorite: true,
  },
  {
    id: "r2",
    name: "Papa Kengne",
    nickname: "Papa",
    country: "Cameroon",
    flag: "🇨🇲",
    phone: "+237 6XX XXX XXX",
    provider: "Orange Money",
    lastSent: "Dec 15, 2025",
    totalSent: 800,
    isFavorite: true,
  },
  {
    id: "r3",
    name: "Grace Achieng",
    nickname: "Auntie Grace",
    country: "Kenya",
    flag: "🇰🇪",
    phone: "+254 7XX XXX XXX",
    provider: "M-Pesa",
    lastSent: "Dec 1, 2025",
    totalSent: 450,
    isFavorite: false,
  },
  {
    id: "r4",
    name: "David Okonkwo",
    nickname: "Cousin David",
    country: "Nigeria",
    flag: "🇳🇬",
    phone: "+234 8XX XXX XXX",
    provider: "Bank Transfer",
    lastSent: "Nov 20, 2025",
    totalSent: 200,
    isFavorite: false,
  },
];

export default function SavedRecipientsScreen() {
  const navigation = useNavigation<SavedRecipientsNavigationProp>();
  const [recipients, setRecipients] = useState<Recipient[]>(mockRecipients);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActionSheet, setShowActionSheet] = useState(false);

  const favorites = recipients.filter((r) => r.isFavorite);
  const others = recipients.filter((r) => !r.isFavorite);

  const filteredRecipients = searchQuery
    ? recipients.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.nickname && r.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
          r.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleAddRecipient = () => {
    navigation.navigate("AddRecipient" as any);
  };

  const handleSelectRecipient = (recipient: Recipient) => {
    // Navigate to send money with this recipient
    navigation.navigate("Remittance" as any, { recipientId: recipient.id });
  };

  const handleEditRecipient = (recipient: Recipient) => {
    // Navigate to edit recipient screen
    setShowActionSheet(false);
    // TODO: Navigate to edit screen
  };

  const handleToggleFavorite = (recipient: Recipient) => {
    setRecipients((prev) =>
      prev.map((r) =>
        r.id === recipient.id ? { ...r, isFavorite: !r.isFavorite } : r
      )
    );
    setShowActionSheet(false);
    setSelectedRecipient(null);
  };

  const handleDeleteRecipient = (recipient: Recipient) => {
    Alert.alert(
      "Delete Recipient",
      `Are you sure you want to delete ${recipient.nickname || recipient.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
            setShowActionSheet(false);
            setSelectedRecipient(null);
          },
        },
      ]
    );
  };

  const RecipientCard = ({ recipient }: { recipient: Recipient }) => (
    <TouchableOpacity
      style={styles.recipientCard}
      onPress={() => handleSelectRecipient(recipient)}
    >
      {/* Avatar */}
      <View style={styles.recipientAvatar}>
        <Text style={styles.recipientFlag}>{recipient.flag}</Text>
        {recipient.isFavorite && (
          <View style={styles.favoriteBadge}>
            <Text style={styles.favoriteBadgeText}>\u2B50</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.recipientInfo}>
        <Text style={styles.recipientName}>
          {recipient.nickname || recipient.name}
        </Text>
        <Text style={styles.recipientProvider}>{recipient.provider}</Text>
        <Text style={styles.recipientMeta}>
          {recipient.lastSent ? `Last: ${recipient.lastSent}` : "Never sent"} • $
          {recipient.totalSent} total
        </Text>
      </View>

      {/* Action */}
      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => {
          setSelectedRecipient(recipient);
          setShowActionSheet(true);
        }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Saved Recipients</Text>
              <Text style={styles.headerSubtitle}>
                {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={handleAddRecipient}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or country..."
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {filteredRecipients ? (
            // Search Results
            <View>
              <Text style={styles.sectionTitle}>
                Search Results ({filteredRecipients.length})
              </Text>
              {filteredRecipients.map((r) => (
                <RecipientCard key={r.id} recipient={r} />
              ))}
              {filteredRecipients.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No recipients found</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Favorites */}
              {favorites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>\u2B50 Favorites</Text>
                  {favorites.map((r) => (
                    <RecipientCard key={r.id} recipient={r} />
                  ))}
                </View>
              )}

              {/* Others */}
              {others.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>All Recipients</Text>
                  {others.map((r) => (
                    <RecipientCard key={r.id} recipient={r} />
                  ))}
                </View>
              )}

              {/* Empty State */}
              {recipients.length === 0 && (
                <View style={styles.emptyStateCard}>
                  <View style={styles.emptyStateIcon}>
                    <Ionicons name="people" size={40} color="#00C6AE" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No Recipients Yet</Text>
                  <Text style={styles.emptyStateDesc}>
                    Add your family and friends to send money quickly
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={handleAddRecipient}
                  >
                    <Text style={styles.emptyStateButtonText}>Add Your First Recipient</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Action Sheet */}
      <Modal
        visible={showActionSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActionSheet(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={styles.actionSheet}>
            {selectedRecipient && (
              <>
                <View style={styles.actionSheetHeader}>
                  <View style={styles.actionSheetRecipient}>
                    <Text style={styles.actionSheetFlag}>{selectedRecipient.flag}</Text>
                    <View>
                      <Text style={styles.actionSheetName}>
                        {selectedRecipient.nickname || selectedRecipient.name}
                      </Text>
                      <Text style={styles.actionSheetCountry}>
                        {selectedRecipient.country}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.actionSheetClose}
                    onPress={() => setShowActionSheet(false)}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.actionSheetActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                    onPress={() => {
                      setShowActionSheet(false);
                      handleSelectRecipient(selectedRecipient);
                    }}
                  >
                    <Text style={styles.actionButtonPrimaryText}>
                      💸 Send Money
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditRecipient(selectedRecipient)}
                  >
                    <Text style={styles.actionButtonText}>✏️ Edit Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleToggleFavorite(selectedRecipient)}
                  >
                    <Text style={styles.actionButtonText}>
                      {selectedRecipient.isFavorite
                        ? "\u2B50 Remove from Favorites"
                        : "\u2B50 Add to Favorites"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => handleDeleteRecipient(selectedRecipient)}
                  >
                    <Text style={styles.actionButtonDangerText}>
                      🗑️ Delete Recipient
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#00C6AE",
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  recipientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  recipientFlag: {
    fontSize: 24,
  },
  favoriteBadge: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  favoriteBadgeText: {
    fontSize: 14,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  recipientProvider: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  recipientMeta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Action Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.8)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  actionSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  actionSheetRecipient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionSheetFlag: {
    fontSize: 28,
  },
  actionSheetName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  actionSheetCountry: {
    fontSize: 12,
    color: "#6B7280",
  },
  actionSheetClose: {
    padding: 8,
  },
  actionSheetActions: {
    gap: 8,
  },
  actionButton: {
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  actionButtonPrimary: {
    backgroundColor: "#F0FDFB",
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#00897B",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  actionButtonDanger: {
    backgroundColor: "#FEE2E2",
  },
  actionButtonDangerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#DC2626",
  },
});
