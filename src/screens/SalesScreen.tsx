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
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatRupiah, formatThickness } from "../utils/currency";

export interface SaleRecord {
  id: string;
  invoice_number: string;
  customer_name?: string;
  cashier_name?: string | null;
  sale_date: string;
  payment_type: "TUNAI" | "QRIS" | "TRANSFER" | "KREDIT";
  payment_status: "LUNAS" | "BELUM_LUNAS";
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  remaining_debt: number;
  notes?: string | null;
}

export interface SaleItemDetail {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  product_name?: string;
  dimension?: string;
  thickness_mm?: number;
  unit?: string;
}

export default function SalesScreen() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LUNAS" | "BELUM_LUNAS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* Detail & Payment Modal */
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItemDetail[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  /* Form Bayar Cicilan Piutang */
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"TUNAI" | "TRANSFER">("TUNAI");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      let query = supabase
        .from("sales")
        .select(`
          id,
          invoice_number,
          customer_name,
          cashier_name,
          sale_date,
          payment_type,
          payment_status,
          subtotal_amount,
          discount_amount,
          tax_amount,
          grand_total,
          paid_amount,
          remaining_debt,
          notes,
          customers ( name )
        `)
        .order("sale_date", { ascending: false })
        .limit(50);

      if (statusFilter !== "ALL") {
        query = query.eq("payment_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: SaleRecord[] = (data || []).map((s) => {
        const cust = s.customers as { name?: string } | null;
        return {
          id: s.id,
          invoice_number: s.invoice_number,
          customer_name: s.customer_name || cust?.name || "Pelanggan Umum",
          cashier_name: s.cashier_name || "Kasir",
          sale_date: s.sale_date,
          payment_type: s.payment_type,
          payment_status: s.payment_status,
          subtotal_amount: Number(s.subtotal_amount || 0),
          discount_amount: Number(s.discount_amount || 0),
          tax_amount: Number(s.tax_amount || 0),
          grand_total: Number(s.grand_total || 0),
          paid_amount: Number(s.paid_amount || 0),
          remaining_debt: Number(s.remaining_debt || 0),
          notes: s.notes,
        };
      });

      setSales(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat histori penjualan";
      console.warn("Gagal memuat penjualan:", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSales();
  };

  /* Open Detail Modal */
  const handleOpenDetail = async (sale: SaleRecord) => {
    setSelectedSale(sale);
    setPayAmount("");
    setPayNotes("");
    setIsLoadingItems(true);

    try {
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          id,
          product_id,
          qty,
          unit_price,
          subtotal,
          products ( name, dimension, thickness_mm, unit )
        `)
        .eq("sale_id", sale.id);

      if (error) throw error;

      const items: SaleItemDetail[] = (data || []).map((it) => {
        const p = it.products as {
          name?: string;
          dimension?: string;
          thickness_mm?: number;
          unit?: string;
        } | null;

        return {
          id: it.id,
          product_id: it.product_id,
          qty: Number(it.qty || 0),
          unit_price: Number(it.unit_price || 0),
          subtotal: Number(it.subtotal || 0),
          product_name: p?.name || "Barang",
          dimension: p?.dimension || "",
          thickness_mm: Number(p?.thickness_mm || 0),
          unit: p?.unit || "BTG",
        };
      });

      setSaleItems(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat rincian nota";
      Alert.alert("Gagal", msg);
    } finally {
      setIsLoadingItems(false);
    }
  };

  /* Submit Payment for Unpaid Sales */
  const handleRecordPayment = async () => {
    if (!selectedSale) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Perhatian", "Nominal pembayaran wajib lebih dari 0");
      return;
    }

    if (amountNum > selectedSale.remaining_debt) {
      Alert.alert(
        "Perhatian",
        `Nominal (${formatRupiah(amountNum)}) melebihi sisa tagihan (${formatRupiah(selectedSale.remaining_debt)})`
      );
      return;
    }

    setIsSubmittingPay(true);
    try {
      const { error } = await supabase.rpc("rpc_pay_receivable", {
        p_sale_id: selectedSale.id,
        p_amount: amountNum,
        p_payment_method: payMethod,
        p_notes: payNotes.trim() || undefined,
      });

      if (error) throw error;

      Alert.alert("Berhasil", "Pembayaran cicilan berhasil disimpan");
      setSelectedSale(null);
      await fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pembayaran";
      Alert.alert("Gagal", msg);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q))
    );
  }, [sales, searchQuery]);

  const renderItem = ({ item }: { item: SaleRecord }) => {
    const isUnpaid = item.payment_status === "BELUM_LUNAS";
    const dateFormatted = new Date(item.sale_date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <TouchableOpacity
        style={styles.saleCard}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
            <Text style={styles.dateText}>{dateFormatted}</Text>
          </View>

          <View style={styles.badgeGroup}>
            <View style={[styles.methodBadge, styles[`method_${item.payment_type}`]]}>
              <Text style={styles.methodBadgeText}>{item.payment_type}</Text>
            </View>
            <View style={[styles.statusBadge, isUnpaid ? styles.statusUnpaid : styles.statusPaid]}>
              <Text style={[styles.statusBadgeText, isUnpaid ? styles.statusTextUnpaid : styles.statusTextPaid]}>
                {isUnpaid ? "Belum Lunas" : "Lunas"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.cashierName}>Kasir: {item.cashier_name}</Text>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>Grand Total</Text>
            <Text style={styles.grandTotalText}>{formatRupiah(item.grand_total)}</Text>
          </View>

          {item.tax_amount > 0 && (
            <View>
              <Text style={styles.footerLabel}>PPN (11%)</Text>
              <Text style={styles.taxText}>{formatRupiah(item.tax_amount)}</Text>
            </View>
          )}

          {isUnpaid ? (
            <View style={styles.alignRight}>
              <Text style={styles.footerLabel}>Sisa Piutang</Text>
              <Text style={styles.remainingDebtText}>{formatRupiah(item.remaining_debt)}</Text>
            </View>
          ) : (
            <View style={styles.alignRight}>
              <Text style={styles.footerLabel}>Terbayar</Text>
              <Text style={styles.paidFullText}>Lunas</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search & Status Filter Bar */}
      <View style={styles.topControlContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari no. faktur atau nama pelanggan..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.statusFilterRow}>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === "ALL" && styles.filterPillActive]}
            onPress={() => setStatusFilter("ALL")}
          >
            <Text style={[styles.filterPillText, statusFilter === "ALL" && styles.filterPillTextActive]}>
              Semua
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === "LUNAS" && styles.filterPillActive]}
            onPress={() => setStatusFilter("LUNAS")}
          >
            <Text style={[styles.filterPillText, statusFilter === "LUNAS" && styles.filterPillTextActive]}>
              Lunas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === "BELUM_LUNAS" && styles.filterPillActive]}
            onPress={() => setStatusFilter("BELUM_LUNAS")}
          >
            <Text style={[styles.filterPillText, statusFilter === "BELUM_LUNAS" && styles.filterPillTextActive]}>
              Tempo / Piutang
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Memuat faktur penjualan...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Tidak Ada Riwayat Penjualan</Text>
              <Text style={styles.emptySubtext}>
                Transaksi kasir baru akan muncul otomatis di sini.
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL DETAIL FAKTUR & CICILAN */}
      <Modal
        visible={selectedSale !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedSale(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detail Faktur Penjualan</Text>
                <Text style={styles.modalSubtitle}>{selectedSale?.invoice_number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedSale(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* Customer and Sale Metadata */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Pelanggan:</Text>
                  <Text style={styles.metaValue}>{selectedSale?.customer_name}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Kasir Bertugas:</Text>
                  <Text style={styles.metaValue}>{selectedSale?.cashier_name}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Tipe Pembayaran:</Text>
                  <Text style={styles.metaValue}>{selectedSale?.payment_type}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Status:</Text>
                  <Text style={[styles.metaValue, { fontWeight: "bold" }]}>
                    {selectedSale?.payment_status === "BELUM_LUNAS" ? "Tempo (Belum Lunas)" : "Lunas"}
                  </Text>
                </View>
              </View>

              {/* Line Items Table */}
              <Text style={styles.sectionHeader}>Daftar Barang Belanjaan</Text>
              {isLoadingItems ? (
                <ActivityIndicator size="small" color="#1E3A8A" style={{ marginVertical: 12 }} />
              ) : (
                <View style={styles.itemsTable}>
                  {saleItems.map((item, idx) => {
                    const hasDim = Boolean(item.dimension && item.dimension.trim());
                    const hasThick = Number(item.thickness_mm || 0) > 0;
                    return (
                      <View key={item.id || idx} style={styles.itemRow}>
                        <View style={styles.itemInfoCol}>
                          <Text style={styles.itemRowName}>{item.product_name}</Text>
                          <Text style={styles.itemRowSpec}>
                            {hasDim ? item.dimension : "Non-profil"}
                            {hasThick ? ` • ${formatThickness(item.thickness_mm!)}` : ""}
                          </Text>
                        </View>
                        <View style={styles.itemQtyCol}>
                          <Text style={styles.itemRowQty}>
                            {item.qty} {item.unit || "BTG"}
                          </Text>
                          <Text style={styles.itemRowPrice}>{formatRupiah(item.unit_price)}</Text>
                        </View>
                        <Text style={styles.itemRowSubtotal}>{formatRupiah(item.subtotal)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Financial Calculation Summary */}
              <View style={styles.calcSummaryBox}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Subtotal</Text>
                  <Text style={styles.calcVal}>{formatRupiah(selectedSale?.subtotal_amount || 0)}</Text>
                </View>

                {Number(selectedSale?.discount_amount || 0) > 0 && (
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Diskon Faktur</Text>
                    <Text style={[styles.calcVal, { color: "#15803D" }]}>
                      -{formatRupiah(selectedSale?.discount_amount || 0)}
                    </Text>
                  </View>
                )}

                {Number(selectedSale?.tax_amount || 0) > 0 && (
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>PPN (11%)</Text>
                    <Text style={styles.calcVal}>{formatRupiah(selectedSale?.tax_amount || 0)}</Text>
                  </View>
                )}

                <View style={[styles.calcRow, styles.calcRowTotal]}>
                  <Text style={styles.calcLabelTotal}>Grand Total</Text>
                  <Text style={styles.calcValTotal}>{formatRupiah(selectedSale?.grand_total || 0)}</Text>
                </View>

                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Sudah Terbayar</Text>
                  <Text style={styles.calcVal}>{formatRupiah(selectedSale?.paid_amount || 0)}</Text>
                </View>

                {Number(selectedSale?.remaining_debt || 0) > 0 && (
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { color: "#B91C1C", fontWeight: "bold" }]}>
                      Sisa Piutang
                    </Text>
                    <Text style={[styles.calcVal, { color: "#B91C1C", fontWeight: "bold" }]}>
                      {formatRupiah(selectedSale?.remaining_debt || 0)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Form Input Pembayaran Cicilan (Jika belum lunas) */}
              {selectedSale?.payment_status === "BELUM_LUNAS" && (
                <View style={styles.payBox}>
                  <Text style={styles.payBoxTitle}>Catat Pembayaran Cicilan</Text>

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

                  <View style={styles.payInputRow}>
                    <TextInput
                      style={styles.payInput}
                      placeholder="Nominal bayar (Rp)"
                      keyboardType="numeric"
                      value={payAmount}
                      onChangeText={setPayAmount}
                    />
                    <TouchableOpacity
                      style={styles.payAllButton}
                      onPress={() => setPayAmount(String(selectedSale.remaining_debt))}
                    >
                      <Text style={styles.payAllText}>Bayar Lunas</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.payNotesInput}
                    placeholder="Catatan pembayaran (opsional)"
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
                      <Text style={styles.submitPayText}>Simpan Pembayaran</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
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
  topControlContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    padding: 12,
    gap: 8,
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
  statusFilterRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
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
  saleCard: {
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
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
    marginBottom: 8,
  },
  invoiceNumber: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  dateText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 4,
  },
  methodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  method_TUNAI: {
    backgroundColor: "#DCFCE7",
  },
  method_QRIS: {
    backgroundColor: "#DBEAFE",
  },
  method_TRANSFER: {
    backgroundColor: "#EDE9FE",
  },
  method_KREDIT: {
    backgroundColor: "#FEF3C7",
  },
  methodBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1E293B",
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPaid: {
    backgroundColor: "#F1F5F9",
  },
  statusUnpaid: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  statusTextPaid: {
    color: "#166534",
  },
  statusTextUnpaid: {
    color: "#991B1B",
  },
  cardBody: {
    marginBottom: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
  },
  cashierName: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 6,
  },
  footerLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  grandTotalText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A",
    marginTop: 1,
  },
  taxText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706",
    marginTop: 1,
  },
  remainingDebtText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B91C1C",
    marginTop: 1,
  },
  paidFullText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#166534",
    marginTop: 1,
  },
  alignRight: {
    alignItems: "flex-end",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#94A3B8",
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
    maxHeight: "92%",
    paddingBottom: 20,
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
  modalScrollContent: {
    padding: 16,
    gap: 12,
  },
  metaBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  metaValue: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  itemsTable: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemInfoCol: {
    flex: 1,
  },
  itemRowName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
  },
  itemRowSpec: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  itemQtyCol: {
    alignItems: "flex-end",
    paddingHorizontal: 8,
  },
  itemRowQty: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  itemRowPrice: {
    fontSize: 10,
    color: "#64748B",
  },
  itemRowSubtotal: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
    minWidth: 70,
    textAlign: "right",
  },
  calcSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    gap: 6,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calcRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#CBD5E1",
    paddingTop: 6,
    marginTop: 2,
  },
  calcLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  calcVal: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "600",
  },
  calcLabelTotal: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0F172A",
  },
  calcValTotal: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  payBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  payBoxTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  payMethodRow: {
    flexDirection: "row",
    gap: 6,
  },
  payMethodPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  payMethodPillActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },
  payMethodText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  payMethodTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  payInputRow: {
    flexDirection: "row",
    gap: 6,
  },
  payInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  payAllButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1E3A8A",
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
    height: 38,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 11,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  submitPayButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 2,
  },
  submitPayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
});
