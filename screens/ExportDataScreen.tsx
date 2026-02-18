import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

interface ExportDataParams {
  circleName?: string;
  circleId?: string;
}

type ExportFormat = "csv" | "pdf" | "excel";
type DateRange = "all" | "year" | "6months" | "3months" | "custom";

interface ExportOption {
  key: string;
  label: string;
  description: string;
  icon: string;
}

export default function ExportDataScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as ExportDataParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [selectedRange, setSelectedRange] = useState<DateRange>("all");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    "transactions",
    "members",
    "summary",
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportedFile, setExportedFile] = useState("");

  const formats = [
    {
      key: "pdf" as ExportFormat,
      label: "PDF Report",
      description: "Formatted document with charts",
      icon: "document-text",
    },
    {
      key: "csv" as ExportFormat,
      label: "CSV Spreadsheet",
      description: "Raw data for analysis",
      icon: "grid-outline",
    },
    {
      key: "excel" as ExportFormat,
      label: "Excel Workbook",
      description: "Multiple sheets with formatting",
      icon: "newspaper-outline",
    },
  ];

  const dateRanges = [
    { key: "all" as DateRange, label: "All Time", description: "Complete history" },
    { key: "year" as DateRange, label: "Past Year", description: "Last 12 months" },
    { key: "6months" as DateRange, label: "6 Months", description: "Last 6 months" },
    { key: "3months" as DateRange, label: "3 Months", description: "Last 3 months" },
  ];

  const exportOptions: ExportOption[] = [
    {
      key: "transactions",
      label: "Transaction History",
      description: "All payments, payouts, and transfers",
      icon: "swap-horizontal",
    },
    {
      key: "members",
      label: "Member Details",
      description: "List of all members and their status",
      icon: "people",
    },
    {
      key: "summary",
      label: "Circle Summary",
      description: "Overview, totals, and statistics",
      icon: "stats-chart",
    },
    {
      key: "schedule",
      label: "Payment Schedule",
      description: "Past and upcoming payment dates",
      icon: "calendar",
    },
    {
      key: "disputes",
      label: "Disputes & Issues",
      description: "Reported problems and resolutions",
      icon: "alert-circle",
    },
    {
      key: "audit",
      label: "Audit Trail",
      description: "All admin actions and changes",
      icon: "shield-checkmark",
    },
  ];

  const toggleOption = (key: string) => {
    setSelectedOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const generateFileName = () => {
    const date = new Date().toISOString().split("T")[0];
    const extension =
      selectedFormat === "excel" ? "xlsx" : selectedFormat === "csv" ? "csv" : "pdf";
    return `${circleName.replace(/\s+/g, "_")}_Export_${date}.${extension}`;
  };

  const handleExport = () => {
    if (selectedOptions.length === 0) {
      Alert.alert("Select Data", "Please select at least one data type to export.");
      return;
    }

    setIsExporting(true);

    // Simulate export process
    setTimeout(() => {
      setIsExporting(false);
      setExportedFile(generateFileName());
      setExportComplete(true);
    }, 2500);
  };

  const renderExportComplete = () => (
    <View style={styles.completeContainer}>
      <View style={styles.completeIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
      </View>

      <Text style={styles.completeTitle}>Export Complete</Text>
      <Text style={styles.completeSubtitle}>
        Your data has been exported successfully
      </Text>

      <View style={styles.fileCard}>
        <View style={styles.fileIconContainer}>
          <Ionicons
            name={
              selectedFormat === "pdf"
                ? "document-text"
                : selectedFormat === "csv"
                ? "grid-outline"
                : "newspaper-outline"
            }
            size={32}
            color="#2563EB"
          />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{exportedFile}</Text>
          <Text style={styles.fileDetails}>
            {selectedOptions.length} data section
            {selectedOptions.length > 1 ? "s" : ""} •{" "}
            {dateRanges.find((r) => r.key === selectedRange)?.label}
          </Text>
        </View>
      </View>

      <View style={styles.deliveryCard}>
        <Ionicons name="mail-outline" size={24} color="#2563EB" />
        <View style={styles.deliveryContent}>
          <Text style={styles.deliveryTitle}>Sent to your email</Text>
          <Text style={styles.deliveryText}>
            The export file has been sent to your registered email address. Check
            your inbox (and spam folder) for the download link.
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => {
            Alert.alert(
              "Download Started",
              "The file is being downloaded to your device."
            );
          }}
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={styles.downloadButtonText}>Download File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            Alert.alert("Share", "Share options would appear here.");
          }}
        >
          <Ionicons name="share-outline" size={20} color="#2563EB" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.newExportButton}
        onPress={() => {
          setExportComplete(false);
          setExportedFile("");
        }}
      >
        <Text style={styles.newExportButtonText}>Create Another Export</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  if (exportComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Export Data</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderExportComplete()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Export Data</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Format</Text>
          <Text style={styles.sectionSubtitle}>Choose your preferred file type</Text>

          <View style={styles.formatGrid}>
            {formats.map((format) => (
              <TouchableOpacity
                key={format.key}
                style={[
                  styles.formatCard,
                  selectedFormat === format.key && styles.formatCardSelected,
                ]}
                onPress={() => setSelectedFormat(format.key)}
              >
                <View
                  style={[
                    styles.formatIcon,
                    selectedFormat === format.key && styles.formatIconSelected,
                  ]}
                >
                  <Ionicons
                    name={format.icon as any}
                    size={28}
                    color={selectedFormat === format.key ? "#FFFFFF" : "#6B7280"}
                  />
                </View>
                <Text
                  style={[
                    styles.formatLabel,
                    selectedFormat === format.key && styles.formatLabelSelected,
                  ]}
                >
                  {format.label}
                </Text>
                <Text style={styles.formatDescription}>{format.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Range Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          <Text style={styles.sectionSubtitle}>Select the time period</Text>

          <View style={styles.rangeContainer}>
            {dateRanges.map((range) => (
              <TouchableOpacity
                key={range.key}
                style={[
                  styles.rangeOption,
                  selectedRange === range.key && styles.rangeOptionSelected,
                ]}
                onPress={() => setSelectedRange(range.key)}
              >
                <Text
                  style={[
                    styles.rangeLabel,
                    selectedRange === range.key && styles.rangeLabelSelected,
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Data Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Include Data</Text>
          <Text style={styles.sectionSubtitle}>
            Select what to include in your export
          </Text>

          {exportOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionCard,
                selectedOptions.includes(option.key) && styles.optionCardSelected,
              ]}
              onPress={() => toggleOption(option.key)}
            >
              <View
                style={[
                  styles.optionIcon,
                  selectedOptions.includes(option.key) && styles.optionIconSelected,
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={22}
                  color={
                    selectedOptions.includes(option.key) ? "#FFFFFF" : "#6B7280"
                  }
                />
              </View>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedOptions.includes(option.key) &&
                      styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  selectedOptions.includes(option.key) && styles.checkboxChecked,
                ]}
              >
                {selectedOptions.includes(option.key) && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Export Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>File Name</Text>
              <Text style={styles.previewValue}>{generateFileName()}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Format</Text>
              <Text style={styles.previewValue}>
                {formats.find((f) => f.key === selectedFormat)?.label}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Date Range</Text>
              <Text style={styles.previewValue}>
                {dateRanges.find((r) => r.key === selectedRange)?.label}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Data Sections</Text>
              <Text style={styles.previewValue}>
                {selectedOptions.length} selected
              </Text>
            </View>
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            (isExporting || selectedOptions.length === 0) &&
              styles.exportButtonDisabled,
          ]}
          onPress={handleExport}
          disabled={isExporting || selectedOptions.length === 0}
        >
          {isExporting ? (
            <>
              <Text style={styles.exportButtonText}>Generating Export...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download-outline" size={22} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Generate Export</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#2563EB" />
          <Text style={styles.infoText}>
            The export file will be sent to your registered email address and
            available for download.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  formatGrid: {
    flexDirection: "row",
    gap: 12,
  },
  formatCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  formatCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  formatIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  formatIconSelected: {
    backgroundColor: "#2563EB",
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  formatLabelSelected: {
    color: "#2563EB",
  },
  formatDescription: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
  },
  rangeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rangeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rangeOptionSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  rangeLabelSelected: {
    color: "#FFFFFF",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  optionCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionIconSelected: {
    backgroundColor: "#2563EB",
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  optionLabelSelected: {
    color: "#2563EB",
  },
  optionDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  previewSection: {
    margin: 16,
    marginBottom: 0,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  previewLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  previewValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
    maxWidth: "60%",
    textAlign: "right",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  exportButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  bottomPadding: {
    height: 40,
  },
  completeContainer: {
    padding: 16,
    alignItems: "center",
  },
  completeIcon: {
    marginVertical: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 20,
    gap: 12,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 12,
  },
  downloadButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2563EB",
  },
  newExportButton: {
    paddingVertical: 14,
    width: "100%",
    marginBottom: 8,
  },
  newExportButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#2563EB",
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
});
