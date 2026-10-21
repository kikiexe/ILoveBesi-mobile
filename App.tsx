import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import SalesScreen from "./src/screens/SalesScreen";
import StockScreen from "./src/screens/StockScreen";
import ReceivablesScreen from "./src/screens/ReceivablesScreen";

type Tab = "ringkasan" | "penjualan" | "stok" | "piutang";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("ringkasan");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Memeriksa sesi login...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>ILuvBesi</Text>
          <Text style={styles.brandSubtitle}>Dashboard Bos Toko</Text>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
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
          <Text style={[styles.navText, activeTab === "ringkasan" && styles.navTextActive]}>
            Ringkasan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "penjualan" && styles.navItemActive]}
          onPress={() => setActiveTab("penjualan")}
          activeOpacity={0.8}
        >
          <Text style={[styles.navText, activeTab === "penjualan" && styles.navTextActive]}>
            Penjualan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "stok" && styles.navItemActive]}
          onPress={() => setActiveTab("stok")}
          activeOpacity={0.8}
        >
          <Text style={[styles.navText, activeTab === "stok" && styles.navTextActive]}>
            Stok Barang
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "piutang" && styles.navItemActive]}
          onPress={() => setActiveTab("piutang")}
          activeOpacity={0.8}
        >
          <Text style={[styles.navText, activeTab === "piutang" && styles.navTextActive]}>
            Piutang
          </Text>
        </TouchableOpacity>
      </View>
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
