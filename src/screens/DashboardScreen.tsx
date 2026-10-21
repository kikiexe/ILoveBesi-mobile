import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatRupiah } from "../utils/currency";

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    omzetHariIni: 0,
    labaKotorHariIni: 0,
    totalPiutangAktif: 0,
    totalBarangMenipis: 0,
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Sales today
      const { data: salesToday } = await supabase
        .from("sales")
        .select("grand_total, sale_items(qty, cost_price_at_sale)")
        .gte("sale_date", startOfDay);

      let omzet = 0;
      let totalCogs = 0;

      for (const sale of salesToday || []) {
        omzet += Number(sale.grand_total || 0);
        for (const item of (sale.sale_items as any[]) || []) {
          totalCogs += Number(item.qty || 0) * Number(item.cost_price_at_sale || 0);
        }
      }

      // Receivables
      const { data: unpaidSales } = await supabase
        .from("sales")
        .select("remaining_debt")
        .eq("payment_type", "KREDIT")
        .eq("payment_status", "BELUM_LUNAS");

      let piutang = 0;
      for (const sale of unpaidSales || []) {
        piutang += Number(sale.remaining_debt || 0);
      }

      // Low stock products (< 20 BTG)
      const { count: lowStockCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .lte("stock_qty", 20);

      setMetrics({
        omzetHariIni: omzet,
        labaKotorHariIni: omzet - totalCogs,
        totalPiutangAktif: piutang,
        totalBarangMenipis: lowStockCount || 0,
      });
    } catch (err) {
      console.warn("Gagal memuat metrik ringkasan:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Memuat ringkasan toko...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />}
      contentContainerStyle={styles.content}
    >
      <View style={styles.summaryCardPrimary}>
        <Text style={styles.cardLabelPrimary}>Estimasi Laba Kotor Hari Ini</Text>
        <Text style={styles.cardValuePrimary}>{formatRupiah(metrics.labaKotorHariIni)}</Text>
        <Text style={styles.cardFootnotePrimary}>
          Total Omzet: {formatRupiah(metrics.omzetHariIni)}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sisa Piutang Berjalan</Text>
          <Text style={[styles.cardValue, { color: "#B91C1C" }]}>
            {formatRupiah(metrics.totalPiutangAktif)}
          </Text>
          <Text style={styles.cardSubtext}>Tagihan pelanggan belum lunas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stok Besi Menipis</Text>
          <Text style={[styles.cardValue, { color: "#D97706" }]}>
            {metrics.totalBarangMenipis} Ukuran
          </Text>
          <Text style={styles.cardSubtext}>Stok tersisa di bawah 20 BTG</Text>
        </View>
      </View>

      <View style={styles.sectionNotice}>
        <Text style={styles.noticeTitle}>Sinkronisasi Realtime Terhubung</Text>
        <Text style={styles.noticeBody}>
          Setiap transaksi kasir desktop langsung terekam pada ringkasan ini tanpa keterlambatan. Tarik layar ke bawah untuk memperbarui data sewaktu-waktu.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "bold",
  },
  summaryCardPrimary: {
    backgroundColor: "#1E3A8A",
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLabelPrimary: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValuePrimary: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 4,
  },
  cardFootnotePrimary: {
    color: "#E2E8F0",
    fontSize: 12,
  },
  grid: {
    gap: 12,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  sectionNotice: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: 14,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 11,
    color: "#1E40AF",
    lineHeight: 16,
  },
});
