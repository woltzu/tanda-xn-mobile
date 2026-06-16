// ══════════════════════════════════════════════════════════════════════════════
// components/ContactPickerModal.tsx — device contact picker + TandaXn matcher.
// ══════════════════════════════════════════════════════════════════════════════
//
// Opened from DomesticSendMoneyScreen via "Import contacts". Flow:
//   1. Request expo-contacts permission (if not granted).
//   2. Fetch device contacts (name + phone numbers only).
//   3. Normalize the phone numbers and call the SECURITY DEFINER RPC
//      `search_users_by_phone(text[])` which returns only matched profiles
//      (no enumeration of the full table).
//   4. Render a searchable list, tagging each contact as "On TandaXn" or
//      "Invite".
//   5. Tap a TandaXn contact → emit onContactPicked({ name, phone, isTandaXn:true,
//      tandaUserName }) so the parent can open NewRecipientModal pre-filled.
//      Tap an Invite contact → opens the device SMS composer with a pre-written
//      invite message via Linking.openURL('sms:...').
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Contacts from "expo-contacts";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";

export type PickedContact = {
  name: string;
  phone: string; // normalized
  isTandaXn: boolean;
  tandaUserName?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onContactPicked: (contact: PickedContact) => void;
};

type DeviceContact = {
  id: string;
  name: string;
  phones: string[]; // each normalized
};

// Cap matched against the RPC's array_length guard.
const MATCH_BATCH_SIZE = 200;

// Strip everything except digits and an optional leading "+".
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

// Avatar initial — first character of name, fallback "?".
function avatarLetter(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

export default function ContactPickerModal({
  visible,
  onClose,
  onContactPicked,
}: Props) {
  const { t } = useTranslation();

  const [permissionStatus, setPermissionStatus] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [matchedPhones, setMatchedPhones] = useState<
    Record<string, { full_name: string | null }>
  >({});
  const [query, setQuery] = useState("");

  // Reset state each time the sheet is reopened so cancellation doesn't leak.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    loadContacts();
  }, [visible]);

  async function loadContacts() {
    setLoading(true);
    try {
      // 1. Permission
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionStatus("denied");
        setLoading(false);
        return;
      }
      setPermissionStatus("granted");

      // 2. Fetch (name + phones only)
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      // 3. Normalize into our shape — drop entries with no name or no phone.
      const seen = new Set<string>();
      const deviceContacts: DeviceContact[] = [];
      const allNormalizedPhones: string[] = [];
      for (const c of data) {
        const name = (c.name || "").trim();
        if (!name) continue;
        const phones: string[] = [];
        for (const p of c.phoneNumbers ?? []) {
          if (!p.number) continue;
          const norm = normalizePhone(p.number);
          if (!norm || seen.has(`${c.id}|${norm}`)) continue;
          seen.add(`${c.id}|${norm}`);
          phones.push(norm);
          allNormalizedPhones.push(norm);
        }
        if (phones.length === 0) continue;
        deviceContacts.push({ id: c.id ?? `${name}-${phones[0]}`, name, phones });
      }
      setContacts(deviceContacts);

      // 4. Match against TandaXn (de-dup, batch).
      const uniquePhones = Array.from(new Set(allNormalizedPhones));
      const matched: Record<string, { full_name: string | null }> = {};
      for (let i = 0; i < uniquePhones.length; i += MATCH_BATCH_SIZE) {
        const batch = uniquePhones.slice(i, i + MATCH_BATCH_SIZE);
        const { data: rows, error } = await supabase.rpc(
          "search_users_by_phone",
          { phone_numbers: batch },
        );
        if (error) {
          // Soft-fail: just don't tag any matches in this batch.
          continue;
        }
        for (const r of (rows as { id: string; full_name: string | null; phone: string }[]) ?? []) {
          if (r.phone) matched[r.phone] = { full_name: r.full_name };
        }
      }
      setMatchedPhones(matched);
    } catch {
      // Soft-fail: empty list, generic error surfacing via empty state.
      setContacts([]);
      setMatchedPhones({});
    } finally {
      setLoading(false);
    }
  }

  // Filtered + sorted list (TandaXn matches first, then alpha by name).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withMatchInfo = contacts.map((c) => {
      const firstMatchedPhone = c.phones.find((p) => p in matchedPhones);
      return {
        ...c,
        isTandaXn: !!firstMatchedPhone,
        matchedPhone: firstMatchedPhone,
        tandaUserName: firstMatchedPhone
          ? matchedPhones[firstMatchedPhone].full_name
          : null,
      };
    });
    const filtered = q
      ? withMatchInfo.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phones.some((p) => p.includes(q)),
        )
      : withMatchInfo;
    return filtered.sort((a, b) => {
      if (a.isTandaXn !== b.isTandaXn) return a.isTandaXn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, matchedPhones, query]);

  function handleSelect(contact: typeof filtered[number]) {
    const phone = contact.matchedPhone ?? contact.phones[0];
    if (contact.isTandaXn) {
      onContactPicked({
        name: contact.tandaUserName ?? contact.name,
        phone,
        isTandaXn: true,
        tandaUserName: contact.tandaUserName,
      });
      onClose();
      return;
    }
    // Non-TandaXn → open SMS composer with pre-written invite text.
    const inviteBody = t("send_money.contact_picker.invite_message");
    const sep = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${phone}${sep}body=${encodeURIComponent(inviteBody)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t("send_money.contact_picker.invite_failed_title"),
        t("send_money.contact_picker.invite_failed_body"),
      );
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>
            {t("send_money.contact_picker.title")}
          </Text>
          <Text style={styles.subtitle}>
            {t("send_money.contact_picker.subtitle")}
          </Text>

          {/* Permission-denied empty state */}
          {permissionStatus === "denied" ? (
            <View style={styles.centerState}>
              <Ionicons
                name="lock-closed-outline"
                size={36}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                {t("send_money.contact_picker.permission_denied")}
              </Text>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>
                  {t("send_money.contact_picker.btn_close")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accentTeal} />
              <Text style={styles.emptyText}>
                {t("send_money.contact_picker.loading")}
              </Text>
            </View>
          ) : (
            <>
              {/* Search */}
              <View style={styles.searchRow}>
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t(
                    "send_money.contact_picker.search_placeholder",
                  )}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setQuery("")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "send_money.contact_picker.clear_search",
                    )}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* List */}
              {filtered.length === 0 ? (
                <View style={styles.centerState}>
                  <Ionicons
                    name="people-outline"
                    size={32}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyText}>
                    {query.length > 0
                      ? t("send_money.contact_picker.empty_search")
                      : t("send_money.contact_picker.empty_no_contacts")}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(c) => c.id}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.avatar,
                          item.isTandaXn && styles.avatarTanda,
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            item.isTandaXn && styles.avatarTextTanda,
                          ]}
                        >
                          {avatarLetter(item.tandaUserName ?? item.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {item.tandaUserName ?? item.name}
                        </Text>
                        <Text style={styles.rowPhone} numberOfLines={1}>
                          {item.matchedPhone ?? item.phones[0]}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          item.isTandaXn
                            ? styles.badgeTanda
                            : styles.badgeInvite,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            item.isTandaXn
                              ? styles.badgeTextTanda
                              : styles.badgeTextInvite,
                          ]}
                        >
                          {item.isTandaXn
                            ? t("send_money.contact_picker.badge_on_tandaxn")
                            : t("send_money.contact_picker.badge_invite")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.btnClose}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.btnCloseText}>
              {t("send_money.contact_picker.btn_close")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },

  centerState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 16,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 2,
  },

  list: {
    maxHeight: 380,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTanda: {
    backgroundColor: colors.accentTeal,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  avatarTextTanda: {
    color: colors.textWhite,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTanda: {
    backgroundColor: colors.tealTintBg,
  },
  badgeInvite: {
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextTanda: {
    color: colors.accentTeal,
  },
  badgeTextInvite: {
    color: colors.textSecondary,
  },

  btnSecondary: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
  },
  btnSecondaryText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 13,
  },
  btnClose: {
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  btnCloseText: {
    color: colors.textWhite,
    fontWeight: "600",
    fontSize: 14,
  },
});
