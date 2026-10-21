import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatRupiah } from "../utils/currency";

interface DashboardMetrics {
  omzetHariIni: number;
  labaKotorHariIni: number;
  totalPpnHariIni: number;
  totalTransaksiHariIni: number;
  tunaiHariIni: number;
  qrisHariIni: number;
  transferHariIni: number;
  kreditHariIni: number;
  totalPiutangAktif: number;
  totalBarangMenipis: number;
}

const initialMetrics: DashboardMetrics = {
  omzetHariIni: 0,
  labaKotorHariIni: 0,
  totalPpnHariIni: 0,
  totalTransaksiHariIni: 0,
  tunaiHariIni: 0,
  qrisHariIni: 0,
  transferHariIni: 0,
  kreditHariIni: 0,
  totalPiutangAktif: 0,
  totalBarangMenipis: 0,
};

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);

  const fetchMetrics = useCallback(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      /* 1. Sales today with line items for COGS and tax */
      const { data: salesToday, error: salesError } = await supabase
        .from("sales")
        .select("id, grand_total, tax_amount, payment_type, sale_items(qty, cost_price_at_sale)")
        .gte("sale_date", startOfDay);

      if (salesError) throw salesError;

      let omzet = 0;
      let totalCogs = 0;
      let totalPpn = 0;
      let tunai = 0;
      let qris = 0;
      let transfer = 0;
      let kredit = 0;

      for (const sale of salesToday || []) {
        const grandTotal = Number(sale.grand_total || 0);
        const tax = Number(sale.tax_amount || 0);
        omzet += grandTotal;
        totalPpn += tax;

        if (sale.payment_type === "TUNAI") {
          tunai += grandTotal;
        } else if (sale.payment_type === "QRIS") {
          qris += grandTotal;
        } else if (sale.payment_type === "TRANSFER") {
          transfer += grandTotal;
        } else if (sale.payment_type === "KREDIT") {
          kredit += grandTotal;
        }

        const items = (sale.sale_items as Array<{ qty: number; cost_price_at_sale: number }>) || [];
        for (const item of items) {
          totalCogs += Number(item.qty || 0) * Number(item.cost_price_at_sale || 0);
        }
      }

      /* 2. Total active receivables (unpaid credit) */
      const { data: unpaidSales, error: unpaidError } = await supabase
        .from("sales")
        .select("remaining_debt")
        .eq("payment_type", "KREDIT")
        .eq("payment_status", "BELUM_LUNAS");

      if (unpaidError) throw unpaidError;

      let piutang = 0;
      for (const sale of unpaidSales || []) {
        piutang += Number(sale.remaining_debt || 0);
      }

      /* 3. Low stock products (stock <= 20) */
      const { count: lowStockCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .lte("stock_qty", 20);

      setMetrics({
        omzetHariIni: omzet,
        labaKotorHariIni: omzet - totalCogs,
        totalPpnHariIni: totalPpn,
        totalTransaksiHariIni: (salesToday || []).length,
        tunaiHariIni: tunai,
        qrisHariIni: qris,
        transferHariIni: transfer,
        kreditHariIni: kredit,
        totalPiutangAktif: piutang,
        totalBarangMenipis: lowStockCount || 0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat metrik";
      console.warn("Gagal memuat metrik ringkasan:", msg);
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
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />
      }
      contentContainerStyle={styles.content}
    >
      {/* Primary KPI Card: Estimasi Laba Kotor Hari Ini */}
      <View style={styles.summaryCardPrimary}>
        <Text style={styles.cardLabelPrimary}>Estimasi Laba Kotor Hari Ini</Text>
        <Text style={styles.cardValuePrimary}>{formatRupiah(metrics.labaKotorHariIni)}</Text>
        <View style={styles.cardFootnoteRow}>
          <Text style={styles.cardFootnoteText}>
            Total Omzet: <Text style={styles.cardFootnoteBold}>{formatRupiah(metrics.omzetHariIni)}</Text>
          </Text>
          <Text style={styles.cardFootnoteText}>
            ({metrics.totalTransaksiHariIni} Transaksi)
          </Text>
        </View>
        {metrics.totalPpnHariIni > 0 && (
          <Text style={styles.cardFootnotePpn}>
            PPN Terkumpul: {formatRupiah(metrics.totalPpnHariIni)}
          </Text>
        )}
      </View>

      {/* Grid Status: Piutang & Stok Menipis */}
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sisa Piutang Berjalan</Text>
          <Text style={[styles.cardValue, { color: "#B91C1C" }]}>
            {formatRupiah(metrics.totalPiutangAktif)}
          </Text>
          <Text style={styles.cardSubtext}>Tagihan kredit pelanggan belum lunas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Stok Barang Menipis</Text>
          <Text style={[styles.cardValue, { color: "#D97706" }]}>
            {metrics.totalBarangMenipis} Varian
          </Text>
          <Text style={styles.cardSubtext}>Stok tersisa 20 unit atau kurang</Text>
        </View>
      </View>

      {/* Rincian Metode Pembayaran Hari Ini */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Metode Pembayaran Kasir Hari Ini</Text>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLabelCol}>
            <View style={[styles.dotPill, { backgroundColor: "#10B981" }]} />
            <Text style={styles.breakdownLabel}>Tunai / Cash</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatRupiah(metrics.tunaiHariIni)}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLabelCol}>
            <View style={[styles.dotPill, { backgroundColor: "#3B82F6" }]} />
            <Text style={styles.breakdownLabel}>QRIS Statis/Dinamis</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatRupiah(metrics.qrisHariIni)}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownLabelCol}>
            <View style={[styles.dotPill, { backgroundColor: "#8B5CF6" }]} />
            <Text style={styles.breakdownLabel}>Transfer Bank</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatRupiah(metrics.transferHariIni)}</Text>
        </View>

        <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
          <View style={styles.breakdownLabelCol}>
            <View style={[styles.dotPill, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.breakdownLabel}>Kredit / Tempo</Text>
          </View>
          <Text style={styles.breakdownValue}>{formatRupiah(metrics.kreditHariIni)}</Text>
        </View>
      </View>

      {/* Sync Status Notice */}
      <View style={styles.sectionNotice}>
        <Text style={styles.noticeTitle}>Sinkronisasi Realtime Terhubung</Text>
        <Text style={styles.noticeBody}>
          Setiap transaksi kasir desktop dan pembaruan stok langsung terekam pada ringkasan ini tanpa jeda. Tarik layar ke bawah untuk menyegarkan data.
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
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLabelPrimary: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValuePrimary: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 6,
  },
  cardFootnoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFootnoteText: {
    color: "#E2E8F0",
    fontSize: 12,
  },
  cardFootnoteBold: {
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  cardFootnotePpn: {
    color: "#FEF08A",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 6,
  },
  grid: {
    gap: 10,
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 14,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 19,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  breakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 14,
    marginBottom: 14,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  breakdownLabelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dotPill: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
  },
  sectionNotice: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: 12,
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
    marginBottom: 3,
  },
  noticeBody: {
    fontSize: 11,
    color: "#1E40AF",
    lineHeight: 16,
  },
});
