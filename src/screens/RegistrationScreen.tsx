import React, { useLayoutEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Yup from "yup";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { Client } from "../models/clients/Client";
import { saveClient } from "../utils/clientStorage";
import { registrationSchema } from "../utils/validationSchemas";
import { ClientRequest } from "../models/auth/ClientRequest";
import { registration } from "../services/authService";
import { useTheme } from "../utils/ThemeProvider";

type RegistrationNavigationParamList = {
  Login: undefined;
  Registration: undefined;
};

export default function RegistrationScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RegistrationNavigationParamList>
    >();

  const { colors } = useTheme();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Hide the native navigation header.
  // No registration/navigation logic is changed.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleRegister = async () => {
    try {
      await registrationSchema.validate(
        { name, surname, username, password, confirmPassword, email },
        { abortEarly: false }
      );

      setErrors({});
      setLoading(true);

      const request: ClientRequest = {
        name,
        surname,
        username,
        password,
        email,
      };

      const response: Client = await registration(request);

      await saveClient(response);

      Alert.alert(
        "Success",
        "Registration completed! We sent you verification e-mail, please verify"
      );

      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
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
        console.error("Registration error:", err);
        Alert.alert("Error", "Registration unsuccessful.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = ({
    label,
    placeholder,
    value,
    onChangeText,
    icon,
    errorKey,
    keyboardType,
    secureTextEntry,
    autoCapitalize = "none",
  }: {
    label: string;
    placeholder: string;
    value: string;
    onChangeText: (value: string) => void;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    errorKey: string;
    keyboardType?: "default" | "email-address";
    secureTextEntry?: boolean;
    autoCapitalize?: "none" | "sentences" | "words" | "characters";
  }) => {
    const hasError = !!errors[errorKey];

    return (
      <View style={styles.inputGroup}>
        <Text
          style={[
            styles.label,
            { color: colors.textPrimary },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.background,
              borderColor: hasError
                ? colors.error
                : colors.borderColor,
            },
          ]}
        >
          <MaterialIcons
            name={icon}
            size={21}
            color={
              hasError
                ? colors.error
                : colors.textSecondary
            }
          />

          <TextInput
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={(text) => {
              onChangeText(text);

              if (errors[errorKey]) {
                setErrors((prev) => ({
                  ...prev,
                  [errorKey]: "",
                }));
              }
            }}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={[
              styles.input,
              { color: colors.textPrimary },
            ]}
          />
        </View>

        <View style={styles.errorContainer}>
          {hasError && (
            <Text
              style={[
                styles.error,
                { color: colors.error },
              ]}
            >
              {errors[errorKey]}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.keyboardContainer,
        { backgroundColor: colors.background },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* App mark */}
          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="waveform"
              size={38}
              color="#fff"
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary },
              ]}
            >
              Sound Flow
            </Text>

            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary },
              ]}
            >
              Create your account and start shaping your sound
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {renderInput({
              label: "Name",
              placeholder: "Enter your name",
              value: name,
              onChangeText: setName,
              icon: "person-outline",
              errorKey: "name",
              autoCapitalize: "words",
            })}

            {renderInput({
              label: "Surname",
              placeholder: "Enter your surname",
              value: surname,
              onChangeText: setSurname,
              icon: "person-outline",
              errorKey: "surname",
              autoCapitalize: "words",
            })}

            {renderInput({
              label: "Username",
              placeholder: "Choose a username",
              value: username,
              onChangeText: setUsername,
              icon: "alternate-email",
              errorKey: "username",
            })}

            {renderInput({
              label: "Email",
              placeholder: "Enter your email",
              value: email,
              onChangeText: setEmail,
              icon: "mail-outline",
              errorKey: "email",
              keyboardType: "email-address",
            })}

            {renderInput({
              label: "Password",
              placeholder: "Create a password",
              value: password,
              onChangeText: setPassword,
              icon: "lock-outline",
              errorKey: "password",
              secureTextEntry: true,
            })}

            {renderInput({
              label: "Confirm password",
              placeholder: "Repeat your password",
              value: confirmPassword,
              onChangeText: setConfirmPassword,
              icon: "lock-outline",
              errorKey: "confirmPassword",
              secureTextEntry: true,
            })}

            {/* Register */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.registerButton,
                {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={handleRegister}
            >
              <MaterialIcons
                name="person-add"
                size={21}
                color="#fff"
              />

              <Text style={styles.registerButtonText}>
                Create account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back to login
          <View style={styles.loginContainer}>
            <Text
              style={[
                styles.loginText,
                { color: colors.textSecondary },
              ]}
            >
              Already have an account?
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.loginLink,
                  { color: colors.primary },
                ]}
              >
                Login
              </Text>
            </TouchableOpacity>
          </View> */}
        </View>
      </ScrollView>

      {/* Registration loading overlay */}
      {loading && (
        <View style={styles.overlay}>
          <View style={styles.loadingCard}>
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
              Registration...
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },

  content: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },

  logoContainer: {
    marginTop: 10,
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,

    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 7,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 340,
  },

  form: {
    width: "100%",
  },

  inputGroup: {
    marginBottom: 1,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 2,
  },

  inputWrapper: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },

  errorContainer: {
    minHeight: 23,
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  error: {
    fontSize: 13,
    fontWeight: "500",
  },

  registerButton: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 7,

    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  loginContainer: {
    alignItems: "center",
    marginTop: 24,
    gap: 5,
  },

  loginText: {
    fontSize: 14,
  },

  loginLink: {
    fontSize: 15,
    fontWeight: "700",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 25, 35, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },

  loadingCard: {
    minWidth: 150,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",

    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
  },
});
