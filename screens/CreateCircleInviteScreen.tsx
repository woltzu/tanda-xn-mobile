import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import * as Contacts from "expo-contacts";

type CreateCircleInviteNavigationProp = StackNavigationProp<RootStackParamList>;
type CreateCircleInviteRouteProp = RouteProp<RootStackParamList, "CreateCircleInvite">;

type Contact = {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  isOnTandaXn: boolean;
  xnScore?: number;
};

// Simulate checking which contacts are on TandaXn
// In production, this would call your backend API with hashed phone numbers
const checkTandaXnUsers = (contacts: Contact[]): Contact[] => {
  // For demo purposes, randomly mark some contacts as TandaXn users
  // In production: send hashed phone numbers to backend, get back matching users
  return contacts.map((contact) => {
    const isOnTandaXn = Math.random() > 0.7; // ~30% chance for demo
    return {
      ...contact,
      isOnTandaXn,
      xnScore: isOnTandaXn ? Math.floor(Math.random() * 40) + 50 : undefined,
    };
  });
};

export default function CreateCircleInviteScreen() {
  const navigation = useNavigation<CreateCircleInviteNavigationProp>();
  const route = useRoute<CreateCircleInviteRouteProp>();
  const {
    circleType,
    name,
    amount,
    frequency,
    memberCount,
    startDate,
    rotationMethod,
    gracePeriodDays,
    beneficiaryName,
    beneficiaryReason,
    beneficiaryPhone,
    beneficiaryCountry,
    isRecurring,
    totalCycles,
  } = route.params;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== "granted") {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      setHasPermission(true);

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      if (data.length > 0) {
        // Process contacts - filter those with phone numbers
        const processedContacts: Contact[] = data
          .filter((contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0)
          .map((contact) => ({
            id: contact.id || Math.random().toString(),
            name: contact.name || "Unknown",
            phone: contact.phoneNumbers?.[0]?.number || "",
            avatar: (contact.name || "U").charAt(0).toUpperCase(),
            isOnTandaXn: false,
          }));
        // Show all contacts - no limit

        // Check which contacts are on TandaXn
        const contactsWithStatus = checkTandaXnUsers(processedContacts);

        // Sort: TandaXn users first, then alphabetically
        contactsWithStatus.sort((a, b) => {
          if (a.isOnTandaXn && !b.isOnTandaXn) return -1;
          if (!a.isOnTandaXn && b.isOnTandaXn) return 1;
          return a.name.localeCompare(b.name);
        });

        setContacts(contactsWithStatus);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const tandaXnContacts = filteredContacts.filter((c) => c.isOnTandaXn);
  const otherContacts = filteredContacts.filter((c) => !c.isOnTandaXn);

  const toggleMember = (contactId: string) => {
    if (selectedMembers.includes(contactId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== contactId));
    } else {
      setSelectedMembers([...selectedMembers, contactId]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#00C6AE";
    if (score >= 70) return "#0A2342";
    if (score >= 50) return "#D97706";
    return "#DC2626";
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Join my TandaXn savings circle "${name}"! Download the app and use invite code: INVITE123`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleRequestPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setIsLoading(true);
      loadContacts();
    }
  };

  const handleContinue = () => {
    const selectedContactsList = contacts.filter((c) =>
      selectedMembers.includes(c.id)
    );

    navigation.navigate("CreateCircleSuccess", {
      circleType,
      name,
      amount,
      frequency,
      memberCount,
      startDate,
      rotationMethod,
      gracePeriodDays,
      invitedMembers: selectedContactsList.map((c) => ({
        id: parseInt(c.id) || 0,
        name: c.name,
        phone: c.phone,
      })),
      // Pass through beneficiary circle fields
      beneficiaryName,
      beneficiaryReason,
      beneficiaryPhone,
      beneficiaryCountry,
      isRecurring,
      totalCycles,
    });
  };

  const renderContactItem = (contact: Contact) => {
    const isSelected = selectedMembers.includes(contact.id);

    return (
      <TouchableOpacity
        key={contact.id}
        style={[
          styles.contactItem,
          isSelected && styles.contactItemSelected,
        ]}
        onPress={() => toggleMember(contact.id)}
      >
        <View
          style={[
            styles.contactAvatar,
            contact.isOnTandaXn && styles.contactAvatarTandaXn,
          ]}
        >
          <Text style={styles.contactAvatarText}>{contact.avatar}</Text>
          {contact.isOnTandaXn && (
            <View style={styles.tandaXnBadge}>
              <Text style={styles.tandaXnBadgeText}>Xn</Text>
            </View>
          )}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.isOnTandaXn && contact.xnScore && (
              <View
                style={[
                  styles.scoreBadge,
                  { backgroundColor: `${getScoreColor(contact.xnScore)}15` },
                ]}
              >
                <Text
                  style={[
                    styles.scoreText,
                    { color: getScoreColor(contact.xnScore) },
                  ]}
                >
                  ⭐ {contact.xnScore}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{contact.phone}</Text>
          {contact.isOnTandaXn && (
            <Text style={styles.onTandaXnText}>On TandaXn</Text>
          )}
        </View>

        {isSelected ? (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.emptyCircle} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Invite Members</Text>
              <Text style={styles.headerSubtitle}>Step 3 of 4</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressStep,
                  step <= 3 && styles.progressStepActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Selection Count */}
          <View style={styles.selectionCard}>
            <View style={styles.selectionTextContainer}>
              <Text style={styles.selectionTitle}>
                {selectedMembers.length} member
                {selectedMembers.length !== 1 ? "s" : ""} selected
              </Text>
              <Text style={styles.selectionSubtitle}>
                You + {selectedMembers.length} = {selectedMembers.length + 1} total •
                No limit
              </Text>
            </View>
            <View style={styles.infinityBadge}>
              <Text style={styles.infinityText}>∞</Text>
            </View>
          </View>

          {/* Share Link Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
            <View style={styles.shareIconContainer}>
              <Ionicons name="share-social" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.shareTextContainer}>
              <Text style={styles.shareTitle}>Share Invite Link</Text>
              <Text style={styles.shareSubtitle}>
                Anyone with the link can request to join
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#00C6AE" />
          </TouchableOpacity>

          {/* Contacts Section */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00C6AE" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : hasPermission === false ? (
            // No permission - show request
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Ionicons name="people" size={40} color="#00C6AE" />
              </View>
              <Text style={styles.permissionTitle}>Access Your Contacts</Text>
              <Text style={styles.permissionDesc}>
                Allow TandaXn to access your contacts to easily invite friends and
                family to your circle. We never send messages without your permission.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handleRequestPermission}
              >
                <Text style={styles.permissionButtonText}>Allow Access</Text>
              </TouchableOpacity>
              <Text style={styles.privacyNote}>
                Your contacts are only used to find friends on TandaXn.
                We never store or share your contact data.
              </Text>
            </View>
          ) : (
            // Has permission - show contacts
            <View style={styles.contactsCard}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search contacts..."
                  placeholderTextColor="#9CA3AF"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* TandaXn Users Section */}
              {tandaXnContacts.length > 0 && (
                <View style={styles.contactSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>On TandaXn</Text>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>
                        {tandaXnContacts.length}
                      </Text>
                    </View>
                  </View>
                  {tandaXnContacts.map(renderContactItem)}
                </View>
              )}

              {/* Other Contacts Section */}
              {otherContacts.length > 0 && (
                <View style={styles.contactSection}>
                  <Text style={styles.sectionTitle}>Invite to TandaXn</Text>
                  {otherContacts.slice(0, 20).map(renderContactItem)}
                  {otherContacts.length > 20 && (
                    <Text style={styles.moreContactsText}>
                      +{otherContacts.length - 20} more contacts
                    </Text>
                  )}
                </View>
              )}

              {filteredContacts.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No contacts found</Text>
                </View>
              )}
            </View>
          )}

          {/* Tip */}
          <View style={styles.tipCard}>
            <Ionicons
              name="information-circle"
              size={18}
              color="#00897B"
              style={styles.tipIcon}
            />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Tip:</Text> Invite members with higher
              XnScores for a more reliable circle. Contacts already on TandaXn can
              join instantly!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>
            {selectedMembers.length > 0
              ? `Continue with ${selectedMembers.length} invite${
                  selectedMembers.length > 1 ? "s" : ""
                }`
              : "Skip for Now"}
          </Text>
        </TouchableOpacity>
      </View>
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
    alignItems: "flex-start",
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
  progressBar: {
    flexDirection: "row",
    gap: 6,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressStepActive: {
    backgroundColor: "#00C6AE",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  selectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionTextContainer: {
    flex: 1,
  },
  selectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  selectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  infinityBadge: {
    backgroundColor: "#F0FDFB",
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infinityText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  shareButton: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shareIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  shareTextContainer: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  shareSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  loadingContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  privacyNote: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 16,
  },
  contactsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0A2342",
  },
  contactSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: "#00C6AE",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  contactItemSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  contactAvatarTandaXn: {
    backgroundColor: "#00C6AE",
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tandaXnBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#0A2342",
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  tandaXnBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#00C6AE",
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  scoreBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: "700",
  },
  contactPhone: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  onTandaXnText: {
    fontSize: 11,
    color: "#00C6AE",
    fontWeight: "600",
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  moreContactsText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
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
  tipCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  tipBold: {
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  continueButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
