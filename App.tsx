import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import SalesScreen from "./src/screens/SalesScreen";
import StockScreen from "./src/screens/StockScreen";
import ReceivablesScreen from "./src/screens/ReceivablesScreen";
import UpdateModal from "./src/components/UpdateModal";
import { useAppUpdate } from "./src/hooks/useAppUpdate";
import { CURRENT_APP_VERSION } from "./src/services/updateService";

type Tab = "ringkasan" | "penjualan" | "stok" | "piutang";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ringkasan");

  const {
    updateInfo,
    isChecking,
    isModalVisible,
    hasUpdate,
    checkUpdates,
    openDownloadUrl,
    dismissModal,
    openModal,
  } = useAppUpdate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1E3A8A" />
        <Text style={styles.loadingText}>Memeriksa sesi login...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
        <UpdateModal
          visible={isModalVisible}
          updateInfo={updateInfo}
          onClose={dismissModal}
          onDownload={openDownloadUrl}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>ILuvBesi</Text>
          <Text style={styles.brandSubtitle}>
            Dashboard Bos Toko &bull; v{CURRENT_APP_VERSION}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {hasUpdate ? (
            <TouchableOpacity
              onPress={openModal}
              style={styles.updateBadgeButton}
              activeOpacity={0.8}
            >
              <Text style={styles.updateBadgeText}>Update Baru</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => checkUpdates(true)}
              style={styles.checkUpdateButton}
              disabled={isChecking}
              activeOpacity={0.8}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#BFDBFE" />
              ) : (
                <Text style={styles.checkUpdateText}>Cek Update</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === "ringkasan" && <DashboardScreen />}
        {activeTab === "penjualan" && <SalesScreen />}
        {activeTab === "stok" && <StockScreen />}
        {activeTab === "piutang" && <ReceivablesScreen />}
      </View>

      {/* Bottom Tabs */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "ringkasan" && styles.navItemActive]}
          onPress={() => setActiveTab("ringkasan")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navText,
              activeTab === "ringkasan" && styles.navTextActive,
            ]}
          >
            Ringkasan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "penjualan" && styles.navItemActive]}
          onPress={() => setActiveTab("penjualan")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navText,
              activeTab === "penjualan" && styles.navTextActive,
            ]}
          >
            Penjualan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "stok" && styles.navItemActive]}
          onPress={() => setActiveTab("stok")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navText,
              activeTab === "stok" && styles.navTextActive,
            ]}
          >
            Stok Barang
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "piutang" && styles.navItemActive]}
          onPress={() => setActiveTab("piutang")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navText,
              activeTab === "piutang" && styles.navTextActive,
            ]}
          >
            Piutang
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dialog Pembaruan Rilis */}
      <UpdateModal
        visible={isModalVisible}
        updateInfo={updateInfo}
        onClose={dismissModal}
        onDownload={openDownloadUrl}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E3A8A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "bold",
  },
  header: {
    backgroundColor: "#1E3A8A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  brandSubtitle: {
    fontSize: 11,
    color: "#93C5FD",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  updateBadgeButton: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  updateBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  checkUpdateButton: {
    borderWidth: 1,
    borderColor: "#3B82F6",
    backgroundColor: "#1E40AF",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    minWidth: 70,
    alignItems: "center",
  },
  checkUpdateText: {
    color: "#DBEAFE",
    fontSize: 11,
    fontWeight: "600",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#DC2626",
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  logoutText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "bold",
  },
  screenContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#CBD5E1",
    height: 56,
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: 3,
    borderTopColor: "transparent",
  },
  navItemActive: {
    borderTopColor: "#1E3A8A",
    backgroundColor: "#EFF6FF",
  },
  navText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  navTextActive: {
    fontWeight: "bold",
    color: "#1E3A8A",
  },
});
