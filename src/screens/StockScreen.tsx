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
  Switch,
  Alert,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { formatRupiah, formatThickness } from "../utils/currency";

export interface Product {
  id: string;
  sku: string;
  name: string;
  dimension: string;
  thickness_mm: number;
  unit: string;
  stock_qty: number;
  avg_cost_price: number;
  sell_price: number;
  include_ppn: boolean;
  is_active: boolean;
}

const COMMON_UNITS = [
  "BTG",
  "KG",
  "TON",
  "GRAM",
  "LBR",
  "PCS",
  "MTR",
  "ROLL",
  "DUS",
  "IKAT",
  "SET",
];

const LOW_STOCK_THRESHOLD = 20;

export default function StockScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* Edit Modal State */
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editDimension, setEditDimension] = useState("");
  const [editThickness, setEditThickness] = useState("");
  const [editUnit, setEditUnit] = useState("BTG");
  const [editStock, setEditStock] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editIncludePpn, setEditIncludePpn] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  /* Add Modal State */
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSku, setAddSku] = useState("");
  const [addName, setAddName] = useState("");
  const [addDimension, setAddDimension] = useState("");
  const [addThickness, setAddThickness] = useState("");
  const [addUnit, setAddUnit] = useState("BTG");
  const [addStock, setAddStock] = useState("0");
  const [addCost, setAddCost] = useState("0");
  const [addPrice, setAddPrice] = useState("0");
  const [addIncludePpn, setAddIncludePpn] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, dimension, thickness_mm, unit, stock_qty, avg_cost_price, sell_price, include_ppn, is_active")
        .order("sku", { ascending: true });

      if (error) throw error;

      const mapped: Product[] = (data || []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        dimension: p.dimension || "",
        thickness_mm: Number(p.thickness_mm || 0),
        unit: p.unit || "BTG",
        stock_qty: Number(p.stock_qty || 0),
        avg_cost_price: Number(p.avg_cost_price || 0),
        sell_price: Number(p.sell_price || 0),
        include_ppn: Boolean(p.include_ppn),
        is_active: p.is_active ?? true,
      }));

      setProducts(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat katalog barang";
      console.warn("Gagal memuat katalog barang:", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchProducts();
  };

  /* Dimensions list for filter chips */
  const dimensionList = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.dimension && p.dimension.trim()) {
        set.add(p.dimension.trim());
      }
    }
    return Array.from(set).sort();
  }, [products]);

  /* Filtered products */
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const dim = p.dimension ? p.dimension.trim() : "";
      const matchesDim =
        dimensionFilter === "all" ||
        (dimensionFilter === "none" ? !dim : dim.toLowerCase() === dimensionFilter.toLowerCase());

      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        dim.toLowerCase().includes(q);

      return matchesDim && matchesSearch;
    });
  }, [products, searchQuery, dimensionFilter]);

  /* Open Edit Modal */
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditDimension(p.dimension || "");
    setEditThickness(p.thickness_mm > 0 ? String(p.thickness_mm) : "");
    setEditUnit(p.unit || "BTG");
    setEditStock(String(p.stock_qty));
    setEditCost(String(p.avg_cost_price));
    setEditPrice(String(p.sell_price));
    setEditIncludePpn(p.include_ppn);
    setEditIsActive(p.is_active);
  };

  /* Submit Edit */
  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    if (!editName.trim()) {
      Alert.alert("Perhatian", "Nama produk tidak boleh kosong");
      return;
    }

    const stockNum = parseInt(editStock, 10);
    const costNum = parseFloat(editCost);
    const priceNum = parseFloat(editPrice);
    const thicknessNum = parseFloat(editThickness) || 0;

    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert("Perhatian", "Stok gudang tidak valid (minimal 0)");
      return;
    }
    if (isNaN(costNum) || costNum < 0) {
      Alert.alert("Perhatian", "HPP rata-rata tidak valid (minimal 0)");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert("Perhatian", "Harga jual tidak valid (minimal 0)");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: editName.trim(),
          dimension: editDimension.trim(),
          thickness_mm: thicknessNum,
          unit: editUnit,
          stock_qty: stockNum,
          avg_cost_price: costNum,
          sell_price: priceNum,
          include_ppn: editIncludePpn,
          is_active: editIsActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProduct.id);

      if (error) throw error;

      Alert.alert("Berhasil", "Data produk berhasil diperbarui");
      setEditingProduct(null);
      await fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui produk";
      Alert.alert("Gagal", msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  /* Submit Add */
  const handleSaveAdd = async () => {
    if (!addSku.trim()) {
      Alert.alert("Perhatian", "SKU produk wajib diisi");
      return;
    }
    if (!addName.trim()) {
      Alert.alert("Perhatian", "Nama produk wajib diisi");
      return;
    }

    const stockNum = parseInt(addStock, 10) || 0;
    const costNum = parseFloat(addCost) || 0;
    const priceNum = parseFloat(addPrice) || 0;
    const thicknessNum = parseFloat(addThickness) || 0;

    if (stockNum < 0 || costNum < 0 || priceNum < 0) {
      Alert.alert("Perhatian", "Stok, HPP, atau Harga Jual tidak boleh negatif");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const { error } = await supabase.from("products").insert({
        sku: addSku.trim().toUpperCase(),
        name: addName.trim(),
        dimension: addDimension.trim(),
        thickness_mm: thicknessNum,
        unit: addUnit,
        stock_qty: stockNum,
        avg_cost_price: costNum,
        sell_price: priceNum,
        include_ppn: addIncludePpn,
        is_active: true,
      });

      if (error) throw error;

      Alert.alert("Berhasil", "Produk baru berhasil ditambahkan");
      setIsAddModalOpen(false);
      setAddSku("");
      setAddName("");
      setAddDimension("");
      setAddThickness("");
      setAddUnit("BTG");
      setAddStock("0");
      setAddCost("0");
      setAddPrice("0");
      setAddIncludePpn(false);
      await fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambah produk baru";
      Alert.alert("Gagal", msg);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const isLowStock = item.stock_qty <= LOW_STOCK_THRESHOLD;
    const margin = item.sell_price - item.avg_cost_price;
    const hasThickness = item.thickness_mm > 0;
    const hasDimension = Boolean(item.dimension && item.dimension.trim());

    return (
      <View style={styles.itemCard}>
        {/* Header bar of item */}
        <View style={styles.itemHeader}>
          <View style={styles.skuRow}>
            <Text style={styles.itemSku}>{item.sku}</Text>
            {item.is_active ? (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Aktif</Text>
              </View>
            ) : (
              <View style={styles.inactivePill}>
                <Text style={styles.inactivePillText}>Nonaktif</Text>
              </View>
            )}
          </View>

          <View style={[styles.stockBadge, isLowStock ? styles.stockBadgeWarning : styles.stockBadgeNormal]}>
            <Text style={[styles.stockBadgeText, isLowStock ? styles.stockBadgeTextWarning : styles.stockBadgeTextNormal]}>
              {item.stock_qty} {item.unit}
            </Text>
          </View>
        </View>

        {/* Product Name */}
        <Text style={styles.itemName}>{item.name}</Text>

        {/* Specification Chips */}
        <View style={styles.specChipsRow}>
          {hasDimension ? (
            <View style={styles.specChip}>
              <Text style={styles.specChipText}>Dimensi: {item.dimension}</Text>
            </View>
          ) : (
            <View style={styles.specChipMuted}>
              <Text style={styles.specChipMutedText}>Non-profil</Text>
            </View>
          )}

          {hasThickness && (
            <View style={styles.specChip}>
              <Text style={styles.specChipText}>Tebal: {formatThickness(item.thickness_mm)}</Text>
            </View>
          )}

          <View style={styles.unitChip}>
            <Text style={styles.unitChipText}>{item.unit}</Text>
          </View>

          {item.include_ppn && (
            <View style={styles.ppnChip}>
              <Text style={styles.ppnChipText}>Inc. PPN</Text>
            </View>
          )}
        </View>

        {/* Financial Grid */}
        <View style={styles.financialGrid}>
          <View style={styles.financialCol}>
            <Text style={styles.financialLabel}>Harga Jual</Text>
            <Text style={styles.priceValue}>{formatRupiah(item.sell_price)}</Text>
          </View>

          <View style={styles.financialCol}>
            <Text style={styles.financialLabel}>HPP Rata-Rata</Text>
            <Text style={styles.costValue}>{formatRupiah(item.avg_cost_price)}</Text>
          </View>

          <View style={styles.financialCol}>
            <Text style={styles.financialLabel}>Margin Untung</Text>
            <Text style={styles.marginValue}>+{formatRupiah(margin)}</Text>
          </View>
        </View>

        {/* Edit Action Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleOpenEdit(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.editButtonText}>Ubah Stok, HPP & Harga</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Add Bar */}
      <View style={styles.topControlContainer}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Ketik SKU atau nama produk..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsAddModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>+ Tambah</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Dimension Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, dimensionFilter === "all" && styles.filterChipActive]}
            onPress={() => setDimensionFilter("all")}
          >
            <Text style={[styles.filterChipText, dimensionFilter === "all" && styles.filterChipTextActive]}>
              Semua ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, dimensionFilter === "none" && styles.filterChipActive]}
            onPress={() => setDimensionFilter("none")}
          >
            <Text style={[styles.filterChipText, dimensionFilter === "none" && styles.filterChipTextActive]}>
              Non-Profil
            </Text>
          </TouchableOpacity>

          {dimensionList.map((dim) => (
            <TouchableOpacity
              key={dim}
              style={[styles.filterChip, dimensionFilter === dim && styles.filterChipActive]}
              onPress={() => setDimensionFilter(dim)}
            >
              <Text style={[styles.filterChipText, dimensionFilter === dim && styles.filterChipTextActive]}>
                {dim}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Memuat katalog barang...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
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
              <Text style={styles.emptyTitle}>Tidak Ada Produk Ditemukan</Text>
              <Text style={styles.emptySubtext}>
                Sesuaikan kata kunci pencarian atau filter dimensi ukuran.
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL EDIT PRODUK */}
      <Modal
        visible={editingProduct !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Data Produk & Stok</Text>
                <Text style={styles.modalSubtitle}>SKU: {editingProduct?.sku}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingProduct(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent}>
              <Text style={styles.inputLabel}>Nama Produk</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Contoh: Hollow Galvanis 40x40"
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dimensi (Opsional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDimension}
                    onChangeText={setEditDimension}
                    placeholder="Contoh: 40x40"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Tebal mm (Opsional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editThickness}
                    onChangeText={setEditThickness}
                    keyboardType="numeric"
                    placeholder="Contoh: 1.2"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Satuan Barang</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitRow}>
                {COMMON_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitSelectPill, editUnit === u && styles.unitSelectPillActive]}
                    onPress={() => setEditUnit(u)}
                  >
                    <Text
                      style={[styles.unitSelectText, editUnit === u && styles.unitSelectTextActive]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Stok Gudang ({editUnit})</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editStock}
                    onChangeText={setEditStock}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>HPP Rata-Rata (Rp)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCost}
                    onChangeText={setEditCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Harga Jual (Rp)</Text>
              <TextInput
                style={styles.modalInput}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
              />

              {/* Include PPN Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Include PPN 11%</Text>
                  <Text style={styles.toggleSubtext}>Harga jual sudah mencakup pajak PPN</Text>
                </View>
                <Switch
                  value={editIncludePpn}
                  onValueChange={setEditIncludePpn}
                  trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
                  thumbColor={editIncludePpn ? "#1E3A8A" : "#F1F5F9"}
                />
              </View>

              {/* Status Aktif Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Status Produk Aktif</Text>
                  <Text style={styles.toggleSubtext}>Tersedia untuk dijual di kasir POS</Text>
                </View>
                <Switch
                  value={editIsActive}
                  onValueChange={setEditIsActive}
                  trackColor={{ false: "#CBD5E1", true: "#10B981" }}
                  thumbColor={editIsActive ? "#047857" : "#F1F5F9"}
                />
              </View>

              <TouchableOpacity
                style={styles.saveSubmitButton}
                onPress={handleSaveEdit}
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveSubmitButtonText}>Simpan Perubahan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL TAMBAH PRODUK BARU */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Produk Baru</Text>
                <Text style={styles.modalSubtitle}>Katalog barang dan inventaris</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent}>
              <Text style={styles.inputLabel}>SKU (Kode Unik)</Text>
              <TextInput
                style={styles.modalInput}
                value={addSku}
                onChangeText={setAddSku}
                placeholder="Contoh: HG-40x40-1.2"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Nama Produk</Text>
              <TextInput
                style={styles.modalInput}
                value={addName}
                onChangeText={setAddName}
                placeholder="Contoh: Hollow Galvanis 40x40"
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Dimensi (Opsional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addDimension}
                    onChangeText={setAddDimension}
                    placeholder="Contoh: 40x40"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Tebal mm (Opsional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addThickness}
                    onChangeText={setAddThickness}
                    keyboardType="numeric"
                    placeholder="0 jika non-profil"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Satuan Barang</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitRow}>
                {COMMON_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitSelectPill, addUnit === u && styles.unitSelectPillActive]}
                    onPress={() => setAddUnit(u)}
                  >
                    <Text
                      style={[styles.unitSelectText, addUnit === u && styles.unitSelectTextActive]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>Stok Awal ({addUnit})</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addStock}
                    onChangeText={setAddStock}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.inputLabel}>HPP Awal (Rp)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={addCost}
                    onChangeText={setAddCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Harga Jual (Rp)</Text>
              <TextInput
                style={styles.modalInput}
                value={addPrice}
                onChangeText={setAddPrice}
                keyboardType="numeric"
              />

              {/* Include PPN Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextCol}>
                  <Text style={styles.toggleLabel}>Include PPN 11%</Text>
                  <Text style={styles.toggleSubtext}>Harga jual sudah mencakup pajak PPN</Text>
                </View>
                <Switch
                  value={addIncludePpn}
                  onValueChange={setAddIncludePpn}
                  trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
                  thumbColor={addIncludePpn ? "#1E3A8A" : "#F1F5F9"}
                />
              </View>

              <TouchableOpacity
                style={styles.saveSubmitButton}
                onPress={handleSaveAdd}
                disabled={isSubmittingAdd}
              >
                {isSubmittingAdd ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveSubmitButtonText}>Tambah Produk</Text>
                )}
              </TouchableOpacity>
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
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  addButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  filterScroll: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
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
  itemCard: {
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
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  skuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemSku: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E3A8A",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#166534",
  },
  inactivePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactivePillText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748B",
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockBadgeNormal: {
    backgroundColor: "#F1F5F9",
  },
  stockBadgeWarning: {
    backgroundColor: "#FEE2E2",
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  stockBadgeTextNormal: {
    color: "#0F172A",
  },
  stockBadgeTextWarning: {
    color: "#991B1B",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0F172A",
    lineHeight: 20,
    marginBottom: 6,
  },
  specChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  specChip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#334155",
  },
  specChipMuted: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specChipMutedText: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#94A3B8",
  },
  unitChip: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unitChipText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6B21A8",
  },
  ppnChip: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ppnChipText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#92400E",
  },
  financialGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 8,
    marginBottom: 10,
  },
  financialCol: {
    flex: 1,
  },
  financialLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  costValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  marginValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#15803D",
  },
  editButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1E3A8A",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  editButtonText: {
    color: "#1E3A8A",
    fontSize: 12,
    fontWeight: "bold",
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
    maxHeight: "90%",
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
    color: "#64748B",
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
  modalFormContent: {
    padding: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 4,
  },
  modalInput: {
    height: 42,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  formCol: {
    flex: 1,
  },
  unitRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  unitSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 6,
  },
  unitSelectPillActive: {
    backgroundColor: "#1E3A8A",
    borderColor: "#1E3A8A",
  },
  unitSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  unitSelectTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 12,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0F172A",
  },
  toggleSubtext: {
    fontSize: 11,
    color: "#64748B",
  },
  saveSubmitButton: {
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
});
