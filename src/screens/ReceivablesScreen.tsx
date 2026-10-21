import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* Modal Bayar Piutang */
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"TUNAI" | "TRANSFER">("TUNAI");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const fetchReceivables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          invoice_number,
          customer_name,
          customer_phone,
          sale_date,
          due_date,
          grand_total,
          remaining_debt,
          customers ( name, phone )
        `)
        .eq("payment_type", "KREDIT")
        .eq("payment_status", "BELUM_LUNAS")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      let total = 0;
      const mapped: Receivable[] = (data || []).map((item) => {
        const cust = item.customers as { name?: string; phone?: string | null } | null;
        const remaining = Number(item.remaining_debt || 0);
        total += remaining;

        return {
          id: item.id,
          invoice_number: item.invoice_number,
          customer_name: item.customer_name || cust?.name || "Pelanggan Umum",
          customer_phone: item.customer_phone || cust?.phone || null,
          sale_date: item.sale_date,
          due_date: item.due_date,
          grand_total: Number(item.grand_total || 0),
          remaining_debt: remaining,
        };
      });

      setReceivables(mapped);
      setTotalDebt(total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat piutang";
      console.warn("Gagal memuat daftar piutang:", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchReceivables();
  };

  const filteredReceivables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return receivables;
    return receivables.filter(
      (r) =>
        r.invoice_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q)
    );
  }, [receivables, searchQuery]);

  const handleOpenPayModal = (item: Receivable) => {
    setSelectedReceivable(item);
    setPayAmount("");
    setPayNotes("");
  };

  const handleRecordPayment = async () => {
    if (!selectedReceivable) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Perhatian", "Nominal pembayaran wajib lebih dari 0");
      return;
    }

    if (amountNum > selectedReceivable.remaining_debt) {
      Alert.alert(
        "Perhatian",
        `Nominal (${formatRupiah(amountNum)}) melebihi sisa tagihan (${formatRupiah(selectedReceivable.remaining_debt)})`
      );
      return;
    }

    setIsSubmittingPay(true);
    try {
      const { error } = await supabase.rpc("rpc_pay_receivable", {
        p_sale_id: selectedReceivable.id,
        p_amount: amountNum,
        p_payment_method: payMethod,
        p_notes: payNotes.trim() || undefined,
      });

      if (error) throw error;

      Alert.alert("Berhasil", "Pembayaran piutang berhasil dicatat");
      setSelectedReceivable(null);
      await fetchReceivables();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pembayaran";
      Alert.alert("Gagal", msg);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const renderItem = ({ item }: { item: Receivable }) => {
    const isOverdue = item.due_date && new Date(item.due_date) < new Date();
    const dueDateFormatted = item.due_date
      ? new Date(item.due_date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Tanpa Jatuh Tempo";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenPayModal(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
          <View style={[styles.statusBadge, isOverdue ? styles.badgeOverdue : styles.badgeNormal]}>
            <Text style={[styles.statusBadgeText, isOverdue ? styles.badgeTextOverdue : styles.badgeTextNormal]}>
              {isOverdue ? "Jatuh Tempo" : "Tempo"}
            </Text>
          </View>
        </View>

        <Text style={styles.customerName}>{item.customer_name}</Text>
        {item.customer_phone ? (
          <Text style={styles.customerPhone}>No. HP: {item.customer_phone}</Text>
        ) : null}
        <Text style={styles.dueDateText}>Jatuh Tempo: {dueDateFormatted}</Text>

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

        <View style={styles.actionPrompt}>
          <Text style={styles.actionPromptText}>Sentuh untuk catat pembayaran cicilan</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary Banner */}
      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryLabel}>Total Piutang Berjalan:</Text>
          <Text style={styles.summaryCount}>({receivables.length} Faktur Belum Lunas)</Text>
        </View>
        <Text style={styles.summaryValue}>{formatRupiah(totalDebt)}</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari pelanggan atau no. faktur tempo..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Memuat data piutang...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReceivables}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Semua Piutang Lunas</Text>
              <Text style={styles.emptyText}>Tidak ada tagihan kredit yang belum lunas saat ini.</Text>
            </View>
          }
        />
      )}

      {/* MODAL BAYAR CICILAN PIUTANG */}
      <Modal
        visible={selectedReceivable !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedReceivable(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Catat Pembayaran Piutang</Text>
                <Text style={styles.modalSubtitle}>{selectedReceivable?.invoice_number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedReceivable(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.debtSummaryBox}>
                <Text style={styles.debtCustName}>{selectedReceivable?.customer_name}</Text>
                <View style={styles.debtRow}>
                  <Text style={styles.debtLabel}>Sisa Tagihan:</Text>
                  <Text style={styles.debtValue}>
                    {formatRupiah(selectedReceivable?.remaining_debt || 0)}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Metode Pembayaran</Text>
              <View style={styles.payMethodRow}>
                <TouchableOpacity
                  style={[styles.payMethodPill, payMethod === "TUNAI" && styles.payMethodPillActive]}
                  onPress={() => setPayMethod("TUNAI")}
                >
                  <Text
                    style={[
                      styles.payMethodText,
                      payMethod === "TUNAI" && styles.payMethodTextActive,
                    ]}
                  >
                    Tunai / Cash
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.payMethodPill,
                    payMethod === "TRANSFER" && styles.payMethodPillActive,
                  ]}
                  onPress={() => setPayMethod("TRANSFER")}
                >
                  <Text
                    style={[
                      styles.payMethodText,
                      payMethod === "TRANSFER" && styles.payMethodTextActive,
                    ]}
                  >
                    Transfer Bank
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Nominal Pembayaran (Rp)</Text>
              <View style={styles.payInputRow}>
                <TextInput
                  style={styles.payInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                />
                <TouchableOpacity
                  style={styles.payAllButton}
                  onPress={() => setPayAmount(String(selectedReceivable?.remaining_debt || 0))}
                >
                  <Text style={styles.payAllText}>Bayar Lunas</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Catatan (Opsional)</Text>
              <TextInput
                style={styles.payNotesInput}
                placeholder="Contoh: Titip lewat supir / transfer BCA"
                value={payNotes}
                onChangeText={setPayNotes}
              />

              <TouchableOpacity
                style={styles.submitPayButton}
                onPress={handleRecordPayment}
                disabled={isSubmittingPay}
              >
                {isSubmittingPay ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitPayText}>Konfirmasi Pembayaran</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  summaryCount: {
    fontSize: 10,
    color: "#B91C1C",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  searchContainer: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  searchInput: {
    height: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "bold",
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    color: "#1E3A8A",
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeNormal: {
    backgroundColor: "#FEF3C7",
  },
  badgeOverdue: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  badgeTextNormal: {
    color: "#92400E",
  },
  badgeTextOverdue: {
    color: "#991B1B",
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  dueDateText: {
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
    fontWeight: "600",
  },
  remainingAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  rightFooter: {
    alignItems: "flex-end",
  },
  totalInvoice: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  actionPrompt: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    paddingTop: 4,
  },
  actionPromptText: {
    fontSize: 10,
    color: "#3B82F6",
    fontStyle: "italic",
    textAlign: "right",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#1E3A8A",
    fontFamily: "monospace",
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
  modalCloseText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
  },
  modalBody: {
    padding: 16,
    gap: 10,
  },
  debtSummaryBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    marginBottom: 4,
  },
  debtCustName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#991B1B",
    marginBottom: 4,
  },
  debtRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  debtLabel: {
    fontSize: 12,
    color: "#7F1D1D",
  },
  debtValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#991B1B",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#334155",
  },
  payMethodRow: {
    flexDirection: "row",
    gap: 8,
  },
  payMethodPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  payMethodPillActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },
  payMethodText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  payMethodTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  payInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  payInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  payAllButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  payAllText: {
    color: "#1E3A8A",
    fontSize: 11,
    fontWeight: "bold",
  },
  payNotesInput: {
    height: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  submitPayButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  submitPayText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
});
