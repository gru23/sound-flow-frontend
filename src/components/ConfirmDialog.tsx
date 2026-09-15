import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { useTheme } from "../utils/ThemeProvider";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

export default function ConfirmDialog({
  visible,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.overlay,
          },
        ]}
      >
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.modalBackground,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: colors.textPrimary,
              },
            ]}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.description,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {description}
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.button,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.borderColor,
                },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  {
                    color: colors.textPrimary,
                  },
                ]}
              >
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.button,
                {
                  backgroundColor: colors.error,
                },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  dialog: {
    width: "85%",
    maxWidth: 420,
    padding: 22,
    borderRadius: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },

  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  button: {
    minWidth: 90,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
