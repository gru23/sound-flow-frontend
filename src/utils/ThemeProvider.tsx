import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

interface ThemeColors {
  background: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  secondary: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
  surfaceBackground: string;
  borderColor: string;
  overlay: string;
  modalBackground: string;
  menuItemBackground: string;
  drawerBackground: string;
}

const darkColors: ThemeColors = {
  background: "#1a1a2e",
  textPrimary: "#ffffff",
  textSecondary: "#b0b0b0",
  textTertiary: "#808080",
  primary: "#7c4dff",
  secondary: "#1f1f3d",
  accent: "#ff6b9d",
  error: "#ff4444",
  success: "#4caf50",
  warning: "#ffa500",
  surfaceBackground: "#2a2a3e",
  borderColor: "#444444",
  overlay: "rgba(0, 0, 0, 0.5)",
  modalBackground: "#252535",
  menuItemBackground: "#3a3a4e",
  drawerBackground: "#1e1e3f",
};

const lightColors: ThemeColors = {
  background: "#ffffff",
  textPrimary: "#000000",
  textSecondary: "#666666",
  textTertiary: "#999999",
  primary: "#7c4dff",
  secondary: "#f0f0f5",
  accent: "#ff6b9d",
  error: "#ff4444",
  success: "#4caf50",
  warning: "#ffa500",
  surfaceBackground: "#f5f5f5",
  borderColor: "#cccccc",
  overlay: "rgba(0, 0, 0, 0.3)",
  modalBackground: "#efefef",
  menuItemBackground: "#e8e8e8",
  drawerBackground: "#fafafa",
};

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState(true);

  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  const value = useMemo<ThemeContextType>(
    () => ({
      colors,
      isDark,
      setIsDark,
      toggleTheme,
    }),
    [colors, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used within ThemeProvider"
    );
  }

  return context;
}
