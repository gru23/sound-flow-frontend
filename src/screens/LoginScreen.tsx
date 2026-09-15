import React, { useEffect, useLayoutEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Keyboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Yup from "yup";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import {
    isStoredGoogleSessionValid,
    loginWithGoogle,
} from "../services/oAuthService";

import { LoginRequest } from "../models/auth/LoginRequest";
import { login, logout } from "../services/authService";

import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    saveTokens,
} from "../utils/authStorage";

import { LogoutRequest } from "../models/auth/LogoutRequest";

import {
    clearClient,
    getClient,
    saveClient,
} from "../utils/clientStorage";

import { loginSchema } from "../utils/validationSchemas";
import { showToast } from "../shared/toastHelper";
import { fetchSeparationMetaData } from "../utils/separationStorage";
import { useTheme } from "../utils/ThemeProvider";

type LoginNavigationParamList = {
    Login: undefined;
    Initial: undefined;
    Registration: undefined;
};

export default function LoginScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<LoginNavigationParamList>>();

    const { colors } = useTheme();

    const [isCheckingSession, setIsCheckingSession] = useState(true);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    /*
     * Hide the native navigation header on the Login screen.
     * The rest of the navigation logic remains unchanged.
     */
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    useEffect(() => {
        let mounted = true;

        const runSilentCheck = async () => {
            try {
                const isValid = await isStoredGoogleSessionValid();

                if (!mounted) {
                    return;
                }

                if (isValid) {
                    await proceedToInitial();
                    return;
                }
            } finally {
                if (mounted) {
                    setIsCheckingSession(false);
                }
            }
        };

        void runSilentCheck();

        return () => {
            mounted = false;
        };
    }, [navigation]);

    /*
     * Google login
     *
     * The actual Google OAuth implementation is unchanged.
     * This button simply calls the existing loginWithGoogle() flow.
     */
    const handleLogin = async () => {
        try {
            const token = await loginWithGoogle();

            if (token) {
                await proceedToInitial();
            } else {
                Alert.alert("Google Login", "Login failed or cancelled.");
            }
        } catch (error) {
            Alert.alert("Google Login Error", String(error));
        }
    };

    if (isCheckingSession) {
        return (
            <View
                style={[
                    styles.sessionContainer,
                    { backgroundColor: colors.background },
                ]}
            >
                <ActivityIndicator
                    size="large"
                    color={colors.primary}
                />
                <Text
                    style={[
                        styles.subtitleText,
                        { color: colors.textSecondary },
                    ]}
                >
                    Provjera prijave...
                </Text>

            </View>
        );
    }

    async function handleLocalLogin() {
        Keyboard.dismiss();
        try {
            await loginSchema.validate(
                { username, password },
                { abortEarly: false }
            );

            setErrors({});
            setLoading(true);

            const request: LoginRequest = {
                username,
                password,
            };

            const response = await login(request);

            await saveTokens(
                response.accessToken,
                response.refreshToken
            );

            await saveClient({
                id: response.id,
                name: response.name,
                surname: response.surname,
                username: response.username,
                email: response.email,
            });

            await proceedToInitial();
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
                    showToast(
                        "error",
                        "Unsuccessful login",
                        "Credentials are not valid."
                    );
                } else {
                    Alert.alert(
                        "Greška",
                        err.message || "Login nije uspio"
                    );
                }
            }
        } finally {
            setLoading(false);
        }
    }

    async function proceedToInitial() {
        await fetchSeparationMetaData();
        navigation.replace("Initial");
    }

    async function handleLogout() {
        try {
            setLogoutLoading(true);

            const token = await getRefreshToken();
            const client = await getClient();

            if (token === null || client === null) return;

            const request: LogoutRequest = {
                clientId: client.id,
                refreshToken: token,
            };

            await logout(request);
            await clearTokens();
            await clearClient();

            Alert.alert("Logout uspješan", `Odjavio se`);
        } catch (error: any) {
            if (error.status === 401) {
                Alert.alert(
                    "Greska",
                    "Logout nije uspio, 401"
                );
            } else {
                Alert.alert(
                    "Greška",
                    error.message || "Login nije uspio"
                );
            }
        } finally {
            setLogoutLoading(false);
        }
    }

    const hasUsernameError = !!errors.username;
    const hasPasswordError = !!errors.password;

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
                    {/* Logo / app mark */}
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
                            size={42}
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
                                styles.subtitleText,
                                { color: colors.textSecondary },
                            ]}
                        >
                            Shape your sound. Your way.
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text
                                style={[
                                    styles.label,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Username or email
                            </Text>

                            <View
                                style={[
                                    styles.inputWrapper,
                                    {
                                        backgroundColor:
                                            colors.background,
                                        borderColor: hasUsernameError
                                            ? colors.error
                                            : colors.borderColor,
                                    },
                                ]}
                            >
                                <MaterialIcons
                                    name="person-outline"
                                    size={21}
                                    color={
                                        hasUsernameError
                                            ? colors.error
                                            : colors.textSecondary
                                    }
                                />

                                <TextInput
                                    placeholder="Enter your username or email"
                                    placeholderTextColor={
                                        colors.textSecondary
                                    }
                                    value={username}
                                    onChangeText={(text) => {
                                        setUsername(text);

                                        if (errors.username) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                username: "",
                                            }));
                                        }
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                />
                            </View>

                            <View style={styles.errorContainer}>
                                {hasUsernameError && (
                                    <Text
                                        style={[
                                            styles.error,
                                            {
                                                color: colors.error,
                                            },
                                        ]}
                                    >
                                        {errors.username}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text
                                style={[
                                    styles.label,
                                    { color: colors.textPrimary },
                                ]}
                            >
                                Password
                            </Text>

                            <View
                                style={[
                                    styles.inputWrapper,
                                    {
                                        backgroundColor:
                                            colors.background,
                                        borderColor: hasPasswordError
                                            ? colors.error
                                            : colors.borderColor,
                                    },
                                ]}
                            >
                                <MaterialIcons
                                    name="lock-outline"
                                    size={21}
                                    color={
                                        hasPasswordError
                                            ? colors.error
                                            : colors.textSecondary
                                    }
                                />

                                <TextInput
                                    placeholder="Enter your password"
                                    placeholderTextColor={
                                        colors.textSecondary
                                    }
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);

                                        if (errors.password) {
                                            setErrors((prev) => ({
                                                ...prev,
                                                password: "",
                                            }));
                                        }
                                    }}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                        },
                                    ]}
                                />
                            </View>

                            <View style={styles.errorContainer}>
                                {hasPasswordError && (
                                    <Text
                                        style={[
                                            styles.error,
                                            {
                                                color: colors.error,
                                            },
                                        ]}
                                    >
                                        {errors.password}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Local login */}
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                                styles.loginButton,
                                {
                                    backgroundColor: colors.primary,
                                },
                            ]}
                            onPress={handleLocalLogin}
                        >
                            <MaterialIcons
                                name="login"
                                size={21}
                                color="#fff"
                            />

                            <Text style={styles.loginButtonText}>
                                Login
                            </Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View
                                style={[
                                    styles.divider,
                                    {
                                        backgroundColor:
                                            colors.borderColor,
                                    },
                                ]}
                            />

                            <Text
                                style={[
                                    styles.dividerText,
                                    {
                                        color: colors.textSecondary,
                                    },
                                ]}
                            >
                                OR
                            </Text>

                            <View
                                style={[
                                    styles.divider,
                                    {
                                        backgroundColor:
                                            colors.borderColor,
                                    },
                                ]}
                            />
                        </View>

                        {/* Google login */}
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={[
                                styles.googleButton,
                                {
                                    backgroundColor:
                                        colors.menuItemBackground ??
                                        colors.background,
                                    borderColor:
                                        colors.borderColor,
                                },
                            ]}
                            onPress={() => {
                                Keyboard.dismiss();
                                handleLogin();
                            }}
                        >
                            <MaterialCommunityIcons
                                name="google"
                                size={21}
                                color="#4285F4"
                            />

                            <Text
                                style={[
                                    styles.googleButtonText,
                                    {
                                        color: colors.textPrimary,
                                    },
                                ]}
                            >
                                Continue with Google
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Registration */}
                    <View style={styles.registrationContainer}>
                        <Text
                            style={[
                                styles.registrationText,
                                {
                                    color: colors.textSecondary,
                                },
                            ]}
                        >
                            Don't have an account?
                        </Text>

                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate("Registration")
                            }
                            hitSlop={8}
                        >
                            <Text
                                style={[
                                    styles.registrationLink,
                                    {
                                        color: colors.primary,
                                    },
                                ]}
                            >
                                Create new account
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/*
                    <TouchableOpacity
                        style={styles.debugButton}
                        onPress={handleLogout}
                    >
                        <Text>Logout</Text>
                    </TouchableOpacity>
                    */}

                    {/*
                    <Button
                        title="Stari JWT"
                        onPress={async () => {
                            console.log(await getAccessToken());
                            const refresh =
                                (await getRefreshToken()) || "";

                            const jwt =
                                "eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiIyIiwic3ViIjoid2ljayIsImV4cCI6MTc3OTEzNzkzMn0.vj0zuSpKyep0i8z2MXxgXErcJlyylFgbAA3rKe3vy-r6jWrRAJzlYyGC1eInvFvPWc14gEGcQOIEzRSRRXaABg";

                            await clearTokens();
                            await saveTokens(jwt, refresh);

                            console.log(await getAccessToken());
                        }}
                    />
                    */}

                    {/*
                    <Button
                        title="Ispisi klijenta"
                        onPress={async () => {
                            const client = await getClient();
                            console.log(client);

                            const access = await getAccessToken();
                            const refresh = await getRefreshToken();

                            console.log(access);
                            console.log(refresh);
                        }}
                    />
                    */}
                </View>
            </ScrollView>

            {/* Local login loading overlay */}
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
                                {
                                    color: colors.textPrimary,
                                },
                            ]}
                        >
                            Login...
                        </Text>
                    </View>
                </View>
            )}

            {/* Logout loading overlay - logic preserved */}
            {logoutLoading && (
                <View style={styles.overlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator
                            size="large"
                            color={colors.primary}
                        />

                        <Text
                            style={[
                                styles.loadingText,
                                {
                                    color: colors.textPrimary,
                                },
                            ]}
                        >
                            Logout...
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

    sessionContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 40,
    },

    content: {
        width: "100%",
        maxWidth: 460,
        alignSelf: "center",
    },

    logoContainer: {
        width: 76,
        height: 76,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        marginBottom: 26,

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
        marginBottom: 34,
    },

    title: {
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: -0.5,
        marginBottom: 8,
        textAlign: "center",
    },

    subtitleText: {
        fontSize: 15,
        lineHeight: 21,
        textAlign: "center",
        maxWidth: 330,
    },

    form: {
        width: "100%",
    },

    inputGroup: {
        marginBottom: 2,
    },

    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        marginLeft: 2,
    },

    inputWrapper: {
        minHeight: 54,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
    },

    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 14,
        paddingHorizontal: 10,
    },

    errorContainer: {
        minHeight: 25,
        justifyContent: "center",
        paddingHorizontal: 3,
    },

    error: {
        fontSize: 13,
        fontWeight: "500",
    },

    loginButton: {
        minHeight: 54,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        marginTop: 4,

        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.16,
        shadowRadius: 7,
        shadowOffset: {
            width: 0,
            height: 4,
        },
    },

    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    dividerContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 22,
    },

    divider: {
        flex: 1,
        height: 1,
    },

    dividerText: {
        fontSize: 12,
        fontWeight: "600",
        marginHorizontal: 14,
    },

    googleButton: {
        minHeight: 54,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },

    googleButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },

    registrationContainer: {
        alignItems: "center",
        marginTop: 30,
        gap: 5,
    },

    registrationText: {
        fontSize: 14,
    },

    registrationLink: {
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

    debugButton: {
        marginTop: 20,
    },
});
