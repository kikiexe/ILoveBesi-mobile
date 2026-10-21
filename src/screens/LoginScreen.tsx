import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { CURRENT_APP_VERSION } from "../services/updateService";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Email dan kata sandi wajib diisi");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.user) {
        setErrorMessage(authError?.message || "Email atau kata sandi tidak valid");
        setIsLoading(false);
        return;
      }

      // Check role strictly in public.profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profile && profile.role !== "owner") {
        await supabase.auth.signOut();
        setErrorMessage("Akses ditolak: Aplikasi mobile khusus untuk pemilik toko (owner).");
        setIsLoading(false);
        return;
      }

      onLoginSuccess();
    } catch {
      setErrorMessage("Koneksi gagal. Periksa jaringan internet Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>ILuvBesi</Text>
          <Text style={styles.brandSubtitle}>Dashboard Pemilik Toko Mobile</Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Pemilik Toko</Text>
          <TextInput
            style={styles.input}
            placeholder="nama@email.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Kata Sandi</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan kata sandi"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Masuk ke Sistem Toko</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerVersion}>
          <Text style={styles.footerVersionText}>
            Versi Aplikasi v{CURRENT_APP_VERSION}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 16,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0F172A",
  },
  brandSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  button: {
    height: 46,
    backgroundColor: "#1E3A8A",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  footerVersion: {
    marginTop: 16,
    alignItems: "center",
  },
  footerVersionText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
});
