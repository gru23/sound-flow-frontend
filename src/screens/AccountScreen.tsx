import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Yup from "yup";

import {
  clearClient,
  getClient,
  getClientId,
  saveClient,
} from "../utils/clientStorage";
import {
  clientUpdateSchema,
  passwordChangeSchema,
} from "../utils/validationSchemas";
import {
  changePassword,
  deleteClient,
  update,
} from "../services/clientService";
import { Client } from "../models/clients/Client";
import { clearTokens } from "../utils/authStorage";
import { useNavigation } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import ConfirmDialog from "../components/ConfirmDialog";
import InputField from "../components/InputField";
import { showToast } from "../shared/toastHelper";
import { useTheme } from "../utils/ThemeProvider";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Account"
>;

export default function AccountScreen() {
  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [originalClient, setOriginalClient] = useState<Client | null>(null);

  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const loadClient = async () => {
      const client = await getClient();

      if (client) {
        setName(client.name);
        setSurname(client.surname);
        setUsername(client.username);
        setEmail(client.email);
        setOriginalClient(client);
      }
    };

    void loadClient();
  }, []);

  const isChanged =
    originalClient &&
    (
      name !== originalClient.name ||
      surname !== originalClient.surname ||
      username !== originalClient.username ||
      email !== originalClient.email
    );

  const handleUpdateAccount = async () => {
    try {
      setLoading(true);
      Keyboard.dismiss();

      await clientUpdateSchema.validate(
        { name, surname, username, email },
        {
          abortEarly: false,
          context: { originalClient },
        }
      );

      setErrors({});

      const clientId = await getClientId();

      if (clientId === null) {
        return;
      }

      const updatedClient: Client = await update(
        clientId,
        {
          name,
          surname,
          username,
          email,
        }
      );

      await saveClient(updatedClient);
      setOriginalClient(updatedClient);

      showToast(
        "success",
        "Account updated",
        "Your changes have been saved."
      );
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        const newErrors: { [key: string]: string } = {};

        err.inner.forEach((e) => {
          if (e.path) {
            newErrors[e.path] = e.message;
          }
        });

        setErrors(newErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setLoading(true);

      await passwordChangeSchema.validate(
        {
          oldPassword,
          newPassword,
          confirmPassword,
        },
        {
          abortEarly: false,
        }
      );

      setErrors({});

      await changePassword({
        oldPassword,
        newPassword,
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      showToast(
        "success",
        "Password changed",
        "Your password has been changed."
      );
    } catch (err: any) {
      if (err instanceof Yup.ValidationError) {
        const newErrors: { [key: string]: string } = {};

        err.inner.forEach((e) => {
          if (e.path) {
            newErrors[e.path] = e.message;
          }
        });

        setErrors(newErrors);
      } else {
        if (err.status === 401) {
          setErrors({
            oldPassword: "Old password is incorrect",
          });
        } else {
          setErrors({
            oldPassword:
              err.message || "Password change failed",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const clientId = await getClientId();

      if (!clientId) {
        return;
      }

      await deleteClient(clientId);
      await clearClient();
      await clearTokens();

      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (err) {
      Alert.alert(
        "Error",
        "Account deletion failed. Please try again."
      );
    } finally {
      setShowDialog(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.background },
      ]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary },
            ]}
          >
            Account
          </Text>

          <Text
            style={[
              styles.headerSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Manage your profile and security
          </Text>
        </View>
      </View>


        {/* Update account */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.menuItemBackground,
              borderColor: colors.textSecondary,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons
              name="person-outline"
              size={24}
              color={colors.primary}
            />

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary },
              ]}
            >
              Personal information
            </Text>
          </View>

          <InputField
            placeholder="Name*"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <InputField
            placeholder="Surname*"
            value={surname}
            onChangeText={setSurname}
            error={errors.surname}
          />

          <InputField
            placeholder="Username*"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />

          <InputField
            placeholder="E-mail"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            editable={false}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: isChanged
                  ? colors.primary
                  : colors.menuItemBackground,
                borderColor: isChanged
                  ? colors.primary
                  : colors.textSecondary,
                borderWidth: isChanged ? 0 : 1,
              },
            ]}
            onPress={handleUpdateAccount}
            disabled={!isChanged}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="save"
              size={20}
              color={isChanged ? "#fff" : colors.textSecondary}
            />

            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: isChanged ? "#fff" : colors.textSecondary,
                },
              ]}
            >
              Update account
            </Text>
          </TouchableOpacity>

        </View>

        {/* Change password */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.menuItemBackground,
              borderColor: colors.textSecondary,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons
              name="lock-outline"
              size={24}
              color={colors.primary}
            />

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary },
              ]}
            >
              Change password
            </Text>
          </View>

          <InputField
            placeholder="Old Password"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
            error={errors.oldPassword}
          />

          <InputField
            placeholder="New Password"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            error={errors.newPassword}
          />

          <InputField
            placeholder="Confirm new Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
          />

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.secondary },
            ]}
            onPress={handleChangePassword}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="lock-reset"
              size={20}
              color="#fff"
            />

            <Text style={styles.primaryButtonText}>
              Change password
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete account */}
        <View
          style={[
            styles.section,
            styles.deleteSection,
            {
              backgroundColor: colors.menuItemBackground,
              borderColor: colors.error,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons
              name="delete-outline"
              size={24}
              color={colors.error}
            />

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textPrimary },
              ]}
            >
              Delete account
            </Text>
          </View>

          <Text
            style={[
              styles.deleteDescription,
              { color: colors.textSecondary },
            ]}
          >
            Permanently delete your account and all associated
            data. This action cannot be undone.
          </Text>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              { borderColor: colors.error },
            ]}
            onPress={() => setShowDialog(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="delete"
              size={20}
              color={colors.error}
            />

            <Text
              style={[
                styles.deleteButtonText,
                { color: colors.error },
              ]}
            >
              Delete account
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {loading && (
        <View style={styles.overlay}>
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.menuItemBackground },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text
              style={[
                styles.loadingText,
                { color: colors.textPrimary },
              ]}
            >
              Updating...
            </Text>
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={showDialog}
        title="Confirm Delete"
        description="Are you sure you want to delete your account? This action cannot be undone."
        onCancel={() => setShowDialog(false)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  section: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  deleteSection: {
    borderWidth: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    marginLeft: 10,
  },

  header: {
    marginBottom: 22,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },

  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },


  deleteDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  deleteButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  deleteButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  bottomSpace: {
    height: 20,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },

  loadingCard: {
    minWidth: 170,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: 20,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
});
