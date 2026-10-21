import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { UpdateCheckResult } from "../services/updateService";

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateCheckResult | null;
  onClose: () => void;
  onDownload: () => void;
}

export default function UpdateModal({
  visible,
  updateInfo,
  onClose,
  onDownload,
}: UpdateModalProps) {
  if (!updateInfo) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>Rilis Baru</Text>
            </View>
            <Text style={styles.title}>Pembaruan Tersedia</Text>
            <Text style={styles.subtitle}>
              Versi baru aplikasi ILuvBesi Mobile telah dirilis di GitHub.
            </Text>
          </View>

          <View style={styles.versionBox}>
            <View style={styles.versionColumn}>
              <Text style={styles.versionLabel}>Terpasang</Text>
              <Text style={styles.versionValueCurrent}>
                v{updateInfo.currentVersion}
              </Text>
            </View>

            <View style={styles.versionArrowBox}>
              <Text style={styles.versionArrow}>&rarr;</Text>
            </View>

            <View style={styles.versionColumn}>
              <Text style={styles.versionLabel}>Terbaru</Text>
              <Text style={styles.versionValueLatest}>
                {updateInfo.latestVersion}
              </Text>
            </View>
          </View>

          {updateInfo.releaseNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesHeader}>Catatan Rilis:</Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={onDownload}
              activeOpacity={0.85}
            >
              <Text style={styles.downloadButtonText}>Unduh APK Sekarang</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.laterButtonText}>Nanti Saja</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  tagBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  tagBadgeText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "bold",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  versionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  versionColumn: {
    alignItems: "center",
  },
  versionLabel: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 2,
  },
  versionValueCurrent: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
  },
  versionValueLatest: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  versionArrowBox: {
    paddingHorizontal: 8,
  },
  versionArrow: {
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "bold",
  },
  notesContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 16,
    maxHeight: 120,
  },
  notesHeader: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 4,
  },
  notesScroll: {
    maxHeight: 80,
  },
  notesText: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
  },
  actionContainer: {
    gap: 8,
  },
  downloadButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  laterButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  laterButtonText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
});
