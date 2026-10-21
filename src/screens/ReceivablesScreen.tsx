import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatRupiah } from "../utils/currency";

interface Receivable {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string | null;
  sale_date: string;
  due_date: string | null;
  grand_total: number;
  remaining_debt: number;
}

export default function ReceivablesScreen() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReceivables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_number, customer_name, customer_phone, sale_date, due_date, grand_total, remaining_debt")
        .eq("payment_type", "KREDIT")
        .eq("payment_status", "BELUM_LUNAS")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      let total = 0;
      for (const item of data || []) {
        total += Number(item.remaining_debt || 0);
      }

      setReceivables(data || []);
      setTotalDebt(total);
    } catch (err) {
      console.warn("Gagal memuat daftar piutang:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  const renderItem = ({ item }: { item: Receivable }) => {
    const isOverdue = item.due_date && new Date(item.due_date) < new Date();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
          <Text style={[styles.statusBadge, isOverdue ? styles.badgeOverdue : styles.badgeNormal]}>
            {isOverdue ? "Jatuh Tempo" : "Belum Lunas"}
          </Text>
        </View>

        <Text style={styles.customerName}>{item.customer_name || "Pelanggan Umum"}</Text>
        {item.customer_phone ? (
          <Text style={styles.customerPhone}>No. HP: {item.customer_phone}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>Sisa Tagihan</Text>
            <Text style={styles.remainingAmount}>{formatRupiah(item.remaining_debt)}</Text>
          </View>
          <View style={styles.rightFooter}>
            <Text style={styles.footerLabel}>Total Faktur</Text>
            <Text style={styles.totalInvoice}>{formatRupiah(item.grand_total)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>Total Piutang Berjalan:</Text>
        <Text style={styles.summaryValue}>{formatRupiah(totalDebt)}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : (
        <FlatList
          data={receivables}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada piutang aktif yang belum lunas</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  summaryBar: {
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#991B1B",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeNormal: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
  },
  badgeOverdue: {
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
  },
  customerPhone: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    marginTop: 8,
  },
  footerLabel: {
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
  },
  remainingAmount: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  rightFooter: {
    alignItems: "flex-end",
  },
  totalInvoice: {
    fontSize: 12,
    color: "#334155",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
