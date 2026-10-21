import { useState, useEffect, useCallback } from "react";
import { Linking, Alert } from "react-native";
import {
  fetchLatestRelease,
  UpdateCheckResult,
} from "../services/updateService";

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  const checkUpdates = useCallback(async (notifyIfLatest: boolean = false) => {
    setIsChecking(true);
    try {
      const result = await fetchLatestRelease();
      if (!result) {
        if (notifyIfLatest) {
          Alert.alert(
            "Cek Pembaruan",
            "Tidak dapat menghubungi server rilis atau koneksi internet bermasalah."
          );
        }
        return;
      }

      setUpdateInfo(result);

      if (result.hasUpdate) {
        setIsModalVisible(true);
      } else if (notifyIfLatest) {
        Alert.alert(
          "Aplikasi Terkini",
          `Aplikasi Anda sudah menggunakan versi terbaru (${result.currentVersion}).`
        );
      }
    } catch {
      if (notifyIfLatest) {
        Alert.alert(
          "Cek Pembaruan",
          "Terjadi kendala saat memeriksa pembaruan aplikasi."
        );
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  const openDownloadUrl = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(updateInfo.downloadUrl);
      if (canOpen) {
        await Linking.openURL(updateInfo.downloadUrl);
      } else {
        Alert.alert(
          "Gagal Membuka Tautan",
          "Tidak dapat membuka browser untuk mengunduh berkas APK."
        );
      }
    } catch {
      Alert.alert(
        "Kesalahan",
        "Terjadi kendala saat membuka browser pengunduhan."
      );
    }
  }, [updateInfo]);

  const dismissModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const openModal = useCallback(() => {
    if (updateInfo?.hasUpdate) {
      setIsModalVisible(true);
    }
  }, [updateInfo]);

  useEffect(() => {
    checkUpdates(false);
  }, [checkUpdates]);

  return {
    updateInfo,
    isChecking,
    isModalVisible,
    hasUpdate: Boolean(updateInfo?.hasUpdate),
    checkUpdates,
    openDownloadUrl,
    dismissModal,
    openModal,
  };
}
