// ══════════════════════════════════════════════════════════════════════════════
// components/MemberInviteSheet.tsx — bottom-sheet multi-select contact picker.
// ══════════════════════════════════════════════════════════════════════════════
//
// Opens from any "Add members" affordance (currently CreateCircleExpressScreen).
// Loads device contacts, matches phones against the SECURITY DEFINER
// `search_users_by_phone` RPC, and lets the user multi-select. On "Done",
// emits the selected contacts list back through `onDone` for the parent to
// pass to `create_circle` as `p_invited_phones` / `p_invited_names`.
//
// Reuses the proven phone-matcher pattern from CreateCircleInviteScreen and
// components/ContactPickerModal — same RPC, same batch cap (200).
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Contacts from "expo-contacts";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";

export type InvitedContact = {
  id: string;
  name: string;
  phone: string; // normalized E.164-ish
  isOnTandaXn: boolean;
  /** UUID of the matched TandaXn profile (null when not on TandaXn). */
  userId?: string | null;
  /** True if this user has been a member of one of my past circles. */
  isPastMember?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onDone: (contacts: InvitedContact[]) => void;
  /** Pre-selected contacts (e.g., from a prior open of the sheet). */
  initialSelected?: InvitedContact[];
  /** UUIDs of users I've been in a circle with — used to tag past members
   *  and seed the auto-recommended pre-selection. Pass from
   *  `useCircles().networkUserIds`. Empty Set is fine (no recommendation). */
  networkUserIds?: Set<string>;
  /** Maximum number of past-member auto-recommendations to pre-select on
   *  first open. Defaults to 3. */
  recommendCount?: number;
};

const PAST_MEMBER_RECOMMEND_DEFAULT = 3;

const MATCH_BATCH_SIZE = 200;

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export default function MemberInviteSheet({
  visible,
  onClose,
  onDone,
  initialSelected = [],
  networkUserIds,
  recommendCount = PAST_MEMBER_RECOMMEND_DEFAULT,
}: Props) {
  const { t } = useTranslation();
  const [permissionStatus, setPermissionStatus] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<InvitedContact[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelected.map((c) => c.id)),
  );

  // Reload contacts each time the sheet is opened so a new set of saved
  // contacts (or a permission grant since last open) gets picked up.
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setSelectedIds(new Set(initialSelected.map((c) => c.id)));
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function loadContacts() {
    setLoading(true);
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionStatus("denied");
        setLoading(false);
        return;
      }
      setPermissionStatus("granted");

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });

      // De-dup by (contactId, normalized phone) so the same contact with
      // multiple phones doesn't render N rows.
      const seen = new Set<string>();
      const normalized: InvitedContact[] = [];
      const allPhones: string[] = [];
      for (const c of data) {
        const name = (c.name || "").trim();
        if (!name) continue;
        for (const p of c.phoneNumbers ?? []) {
          if (!p.number) continue;
          const phone = normalizePhone(p.number);
          if (!phone) continue;
          const key = `${c.id}|${phone}`;
          if (seen.has(key)) continue;
          seen.add(key);
          normalized.push({
            id: key,
            name,
            phone,
            isOnTandaXn: false,
          });
          allPhones.push(phone);
        }
      }

      // Batch RPC matching — same pattern as ContactPickerModal. We capture
      // the user_id (not just the phone) so we can cross-reference against
      // `networkUserIds` and tag past-circle members.
      const uniquePhones = Array.from(new Set(allPhones));
      const matchedByPhone = new Map<string, string>(); // phone → user_id
      for (let i = 0; i < uniquePhones.length; i += MATCH_BATCH_SIZE) {
        const batch = uniquePhones.slice(i, i + MATCH_BATCH_SIZE);
        const { data: rows, error } = await supabase.rpc(
          "search_users_by_phone",
          { phone_numbers: batch },
        );
        if (error) {
          console.warn("[MemberInviteSheet] match batch failed:", error.message);
          continue;
        }
        for (const r of (rows as { id: string; phone: string }[] | null) ?? []) {
          if (r?.phone) matchedByPhone.set(r.phone, r.id);
        }
      }

      const tagged: InvitedContact[] = normalized.map((c) => {
        const userId = matchedByPhone.get(c.phone) ?? null;
        const isOnTandaXn = userId !== null;
        const isPastMember =
          isOnTandaXn && !!networkUserIds && networkUserIds.has(userId!);
        return { ...c, isOnTandaXn, userId, isPastMember };
      });
      // Sort: past members first (most relevant), then other TandaXn
      // matches, then off-TandaXn contacts alpha.
      tagged.sort((a, b) => {
        const aRank = a.isPastMember ? 0 : a.isOnTandaXn ? 1 : 2;
        const bRank = b.isPastMember ? 0 : b.isOnTandaXn ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
        return a.name.localeCompare(b.name);
      });
      setContacts(tagged);

      // Auto-select up to `recommendCount` past members on the first open
      // (when the caller didn't pre-set any selection). Users can deselect
      // any of them — this is a starting suggestion, not an enforcement.
      if (initialSelected.length === 0) {
        const recommended = tagged
          .filter((c) => c.isPastMember)
          .slice(0, recommendCount)
          .map((c) => c.id);
        if (recommended.length > 0) {
          setSelectedIds(new Set(recommended));
        }
      }
    } catch (err) {
      console.warn("[MemberInviteSheet] loadContacts failed:", err);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts, query]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const picks = contacts.filter((c) => selectedIds.has(c.id));
    setQuery("");
    onDone(picks);
  };

  const selectedCount = selectedIds.size;

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

          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {t("member_invite_sheet.title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t("member_invite_sheet.close")}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {t("member_invite_sheet.subtitle")}
          </Text>

          {permissionStatus === "denied" ? (
            <View style={styles.centerState}>
              <Ionicons
                name="lock-closed-outline"
                size={36}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                {t("member_invite_sheet.permission_denied")}
              </Text>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>
                  {t("member_invite_sheet.btn_close")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accentTeal} />
              <Text style={styles.emptyText}>
                {t("member_invite_sheet.loading")}
              </Text>
            </View>
          ) : (
            <>
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
                  placeholder={t("member_invite_sheet.search_placeholder")}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setQuery("")}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              {filtered.length === 0 ? (
                <View style={styles.centerState}>
                  <Ionicons
                    name="people-outline"
                    size={28}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyText}>
                    {query.length > 0
                      ? t("member_invite_sheet.empty_search")
                      : t("member_invite_sheet.empty_no_contacts")}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(c) => c.id}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() => toggle(item.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checkboxOn,
                          ]}
                        >
                          {selected ? (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#FFFFFF"
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.rowPhone} numberOfLines={1}>
                            {item.phone}
                          </Text>
                        </View>
                        {item.isPastMember ? (
                          <View style={styles.badgePast}>
                            <Text style={styles.badgePastText}>
                              {t("member_invite_sheet.badge_past_member")}
                            </Text>
                          </View>
                        ) : item.isOnTandaXn ? (
                          <View style={styles.badgeTanda}>
                            <Text style={styles.badgeTandaText}>
                              {t("member_invite_sheet.badge_on_tandaxn")}
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.btnCancelText}>
                {t("member_invite_sheet.btn_cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnDone}
              onPress={handleDone}
              accessibilityRole="button"
            >
              <Text style={styles.btnDoneText}>
                {selectedCount > 0
                  ? t("member_invite_sheet.btn_done_count", {
                      count: selectedCount,
                    })
                  : t("member_invite_sheet.btn_done")}
              </Text>
            </TouchableOpacity>
          </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: { padding: 4 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },

  centerState: {
    alignItems: "center",
    paddingVertical: 36,
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

  list: { maxHeight: 380 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.accentTeal,
    borderColor: colors.accentTeal,
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
  badgeTanda: {
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTandaText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  badgePast: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePastText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnCancelText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 14,
  },
  btnDone: {
    flex: 1,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnDoneText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
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
});
