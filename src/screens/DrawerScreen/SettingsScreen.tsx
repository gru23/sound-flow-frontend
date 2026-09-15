import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Switch,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { showToast } from "../../shared/toastHelper";
import {
  deleteAllLocalSeparations,
  isLocalSeparationsStoringEnabled,
  setLocalSeparationStoring,
} from "../../utils/separationStorage";

import { switchColors } from "../../constants/switchColors";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useTheme } from "../../utils/ThemeProvider";

export default function SettingsScreen() {
  const { colors, isDark, setIsDark } = useTheme();

  const [localStoring, setLocalStoring] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  useEffect(() => {
    const loadLocalStoring = async () => {
      const isEnabledLocalStoring =
        await isLocalSeparationsStoringEnabled();

      setLocalStoring(isEnabledLocalStoring);
    };

    void loadLocalStoring();
  }, []);

  const handleLocalStoringChange = async (value: boolean) => {
    setLocalStoring(value);
    await setLocalSeparationStoring(value);
  };

  const handleDarkThemeChange = (value: boolean) => {
    setIsDark(value);
  };

  const removeSeparations = async () => {
    await deleteAllLocalSeparations();

    setShowDeleteModal(false);

    showToast(
      "success",
      "Successfully deleted",
      "Local separations have been deleted."
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Local separation storing */}
      <View
        style={[
          styles.row,
          {
            borderBottomColor: colors.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          {`Local separation storing ${
            localStoring ? "enabled" : "disabled"
          }`}
        </Text>

        <Switch
          value={localStoring}
          onValueChange={handleLocalStoringChange}
          trackColor={switchColors.trackColor}
          thumbColor={
            localStoring
              ? switchColors.thumbColorOn
              : switchColors.thumbColorOff
          }
          ios_backgroundColor={switchColors.iosBackground}
        />
      </View>

      {/* Dark theme */}
      <View
        style={[
          styles.row,
          {
            borderBottomColor: colors.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          Dark theme
        </Text>

        <Switch
          value={isDark}
          onValueChange={handleDarkThemeChange}
          trackColor={switchColors.trackColor}
          thumbColor={
            isDark
              ? switchColors.thumbColorOn
              : switchColors.thumbColorOff
          }
          ios_backgroundColor={switchColors.iosBackground}
        />
      </View>

      {/* Delete local separations */}
      <View
        style={[
          styles.row,
          {
            borderBottomColor: colors.borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          Delete all local separations
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.deleteButton,
            {
              backgroundColor: colors.error,
            },
          ]}
          onPress={() => setShowDeleteModal(true)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={showDeleteModal}
        title="Delete local separations"
        description="Do you want to delete separations from your application? You will still be able to download stems from server."
        onConfirm={removeSeparations}
        onCancel={() => setShowDeleteModal(false)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  label: {
    flex: 1,
    fontSize: 16,
    marginRight: 16,
  },

  deleteButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },

  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
