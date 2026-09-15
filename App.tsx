import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { MenuProvider } from 'react-native-popup-menu';
import Toast, { BaseToast, ToastConfig } from 'react-native-toast-message';
import LoginScreen from './src/screens/LoginScreen';

import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from "expo-document-picker";
import { Asset } from 'expo-asset';
import FiltersScreen from './src/screens/FiltersScreen';
import VisualScreen from './src/screens/VisualScreen';
import SkiaVisualScreen from './src/screens/SkiaVisualScreen';
import EditorScreen from './src/screens/Editor/EditorScreen';
import SourceSeparationPlayerScreen from './src/screens/SourceSeparationScreen/SourceSeparationPlayerScreen';
import PickerScreen from './src/screens/PickerScreen';
import RecorderScreen from './src/screens/RecorderScreen';
import InitialNavigator from './src/navigation/InitialNavigator';
import { isStoredGoogleSessionValid } from './src/services/oAuthService';
import { checkJwtValid } from './src/services/authService';
import RegistrationScreen from './src/screens/RegistrationScreen';
import AccountScreen from './src/screens/AccountScreen';
import InitialScreen from './src/screens/InitialScreen/InitialScreen';
import AllSeparationsScreen from './src/screens/InitialScreen/AllSeparationsScreen';
import { SeparationWatcherProvider } from './src/utils/SeparationWatcherProvider';
import { SEPARATIONS_PATH } from './src/utils/separationStorage';
import SettingsScreen from './src/screens/DrawerScreen/SettingsScreen';
import { SeparationOption } from './src/models/separations-jobs/SeparationOption';
import { ThemeProvider, useTheme } from './src/utils/ThemeProvider';
// import { createDrawerNavigator } from '@react-navigation/drawer';
// import { DrawerNavigator } from './src/navigation/DrawerNavigator';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Filters: undefined;
  Visual: undefined;
  SkiaVisual: { path: string };
  EditorScreen: { path: string };
  SourceSeparation: { id: string };
  Picker: undefined;
  Recorder: { nextScreen: string, separationType: SeparationOption };
  Initial: undefined;
  Registration: undefined;
  Account: undefined;
  AllSeparations: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
// const Drawer = createDrawerNavigator();

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

function HomeScreen({ navigation }: HomeScreenProps) {
  const [inputPath, setInputPath] = useState<string>('');
  const [isInputReady, setIsInputReady] = useState(false);

  // async function copyAsset(module: string, destName: string) {
  //   const asset = Asset.fromModule(module);
  //   await asset.downloadAsync();
  //   const sourceUri = asset.localUri === null ? "" : asset.localUri;
  //   const destUri = FileSystem.documentDirectory + destName;
  //   await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  //   console.log('Kopirano u:', destUri);
  // }

  const copyInputAsset = useCallback(async () => {
    // await copyAsset(require('./assets/bass.wav'), 'bass.wav');
    // await copyAsset(require('./assets/drums.wav'), 'drums.wav');
    // await copyAsset(require('./assets/vocals.wav'), 'vocals.wav');
    // await copyAsset(require('./assets/other.wav'), 'other.wav');


    const asset = Asset.fromModule(require('./assets/input.wav'));
    await asset.downloadAsync();
    // inputBD_44.1_16b_5s.wav inputBD_8kHz_8b_5s.wav inputBD.wav
    const fileName = "inputBD_44.1_16b_5s.wav";
    const fileName1 = "inputBD_8kHz_8b_5s.wav";
    const fileName2 = "inputBD.wav";
    const finalFileName = fileName;

    const assetBD = Asset.fromModule(require('./assets/' + finalFileName));
    await assetBD.downloadAsync();

    const destPath = FileSystem.documentDirectory + 'input.wav';
    const sourceUri = asset.localUri ?? asset.uri;

    const destPathBD = FileSystem.documentDirectory + finalFileName;
    const sourceUriBD = assetBD.localUri ?? assetBD.uri;

    // Always replace sandbox copies so selected file is guaranteed to be current.
    await FileSystem.deleteAsync(destPathBD, { idempotent: true });

    await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    setInputPath(destPath);
    setIsInputReady(true);
    console.log('Asset kopiran u:', destPath);

    // await FileSystem.copyAsync({ from: sourceUriBD, to: destPathBD });
    // setInputPath(destPathBD);
    // setIsInputReady(true);
    // console.log('Asset kopiran u:', destPathBD);

    // kopiraj inputBD.wav u sandbox
    await FileSystem.copyAsync({ from: sourceUriBD, to: destPathBD });
    console.log('Asset kopiran u:', destPathBD);

    // odmah ga degradiraj na 8‑bit / 8 kHz
    const degradedPath = FileSystem.documentDirectory + 'inputBD_degraded.wav';
    await FileSystem.deleteAsync(degradedPath, { idempotent: true });
    const ffmpegCommand = `-y -i ${destPathBD} -ac 2 -ar 8000 -acodec pcm_u8 ${degradedPath}`;
    await FFmpegKit.execute(ffmpegCommand);

    // koristi degradirani fajl za vizualizaciju
    setInputPath(degradedPath);
    setIsInputReady(true);
    console.log('Degradirani asset spreman u:', degradedPath);
  }, []);

  useEffect(() => {
    copyInputAsset();
  }, [copyInputAsset]);

  async function deleteStems() {
    const files = await FileSystem.readDirectoryAsync(SEPARATIONS_PATH);
    for(const file of files) {
      await FileSystem.deleteAsync(`${SEPARATIONS_PATH}/${file}`, {idempotent: true});
    }
  }

  async function playOriginal() {
    try {
      if (!isInputReady || !inputPath) {
        await copyInputAsset();
      }

      if (!inputPath) {
        throw new Error('Input asset nije dostupan.');
      }

      const sound = new Audio.Sound();
      // await sound.loadAsync({ uri: FileSystem.documentDirectory + 'output.mp3' });
      // await sound.loadAsync({ uri: (FileSystem as any).documentDirectory + 'output.wav' });
      await sound.loadAsync({ uri: inputPath });
      await sound.playAsync();
      console.log('Puštam originalni MP3...');
    } catch (err) {
      console.error('Greška pri puštanju originala:', err);
    }
  }

  async function trimAndPlay() {
    try {
      // const inputPath = FileSystem.documentDirectory + 'output.mp3';
      // const trimmedPath = FileSystem.documentDirectory + 'trimmed.mp3';
      const inputPath = FileSystem.documentDirectory + 'input.wav';
      const trimmedPath = FileSystem.documentDirectory + 'trimmed.wav';

      // Trimuj od 1s do 3s
      const command = `-i ${inputPath} -ss 00:00:01 -to 00:00:03 -c copy ${trimmedPath}`;
      await FFmpegKit.execute(command);

      console.log('Trimovanje završeno!');

      const info = await FileSystem.getInfoAsync(trimmedPath);
      console.log('Trimovani fajl info:', info);

      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: trimmedPath });
      await sound.playAsync();
      console.log('Puštam trimovani MP3...');
    } catch (err) {
      console.error('Greška pri trimovanju/puštanju:', err);
    }
  }

  async function listFiles() {
    try {
      const path = FileSystem.documentDirectory === null ? "" : FileSystem.documentDirectory;
      const files = await FileSystem.readDirectoryAsync(path);
      console.log("Sadržaj sandboxa:", files);

      const pathSep = FileSystem.documentDirectory === null ? "" : FileSystem.documentDirectory + "/separations";
      const sep = await FileSystem.readDirectoryAsync(pathSep);
      console.log("Sadržaj separations:", sep);
    } catch (error) {
      console.log("Greška:", error);
    }
  }

  return(
    <View style={styles.container}>
      <Text>Dobrodošli na početnu stranicu!</Text>
      <Button title='Login' onPress={() => navigation.navigate('Login')} />
      <Text>Open up App.js to start working on your app!</Text>
      <Text>Radi li?</Text>
      <Button title='Filters' onPress={() => navigation.navigate('Filters')} />

      <Text>MP3 Player Demo</Text>
      <Button title="▶️ Pusti Original" onPress={playOriginal} />
      <View style={{ marginTop: 20 }} />
      <Button title="✂️ Trimuj i Pusti" onPress={trimAndPlay} />

      <View style={styles.loginContainer} />
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.login}>Sign in</Text>
      </TouchableOpacity>
      <Button title='Visual' onPress={() => navigation.navigate('Visual')} />
        <Button title='Skia Visual' onPress={() => navigation.navigate('SkiaVisual', { path: 'test2'})} />
      <Button title='Sandbox' onPress={listFiles} />
      {/* <Button title='SourceSeparation' onPress={() => navigation.navigate('SourceSeparation')} /> */}
      <Button title='Picker' onPress={() => navigation.navigate('Picker')} />
      <Button title='Recorder' onPress={() => navigation.navigate('Recorder', { nextScreen: 'nesto iz App', separationType: SeparationOption.FOUR_STEMS })} />
      <Button title='Initial' onPress={() => navigation.navigate('Initial')} />
      <Button title='Account' onPress={() => navigation.navigate('Account')} />
      <Button title='Delete Stems' onPress={deleteStems} />
      <Button title='Settings' onPress={() => navigation.navigate('Settings')} />
      <StatusBar style='auto' />
    </View>
  );
}

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'green' }}
      text1Style={{ fontSize: 16 }}
      text2Style={{ fontSize: 14 }}
    />
  ),
  error: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'red' }}
      text1Style={{ fontSize: 16 }}
      text2Style={{ fontSize: 14 }}
    />
  ),
};

function AppContent() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <MenuProvider>
        <SeparationWatcherProvider>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Filters" component={FiltersScreen} />
              <Stack.Screen name="Visual" component={VisualScreen} />
              <Stack.Screen
                name="SkiaVisual"
                component={SkiaVisualScreen}
                initialParams={{ path: "test2" }}
              />
              <Stack.Screen
                name="EditorScreen"
                component={EditorScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="SourceSeparation"
                component={SourceSeparationPlayerScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen name="Picker" component={PickerScreen} />
              <Stack.Screen name="Recorder" component={RecorderScreen} />
              <Stack.Screen name="Initial" component={InitialScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="AllSeparations"
                component={AllSeparationsScreen}
              />
              <Stack.Screen
                name="Registration"
                component={RegistrationScreen}
              />
              <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
        </SeparationWatcherProvider>
      </MenuProvider>

      <StatusBar style={isDark ? "light" : "dark"} />

      <Toast config={toastConfig} />
    </>
  );
}


export default function App() {
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveAuthState = async () => {
      try {
        const validSession = await checkJwtValid();

        const ispis = validSession
          ? "PRIJAVLJEN"
          : "NIJE PRIJAVLJEN";

        console.log(ispis);

        if (mounted) {
          setIsAuthenticated(validSession);
        }
      } finally {
        if (mounted) {
          setIsAuthResolved(true);
        }
      }
    };

    void resolveAuthState();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isAuthResolved) {
    return (
      <View style={styles.authLoaderContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.authLoaderText}>
          Provjera prijave...
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    marginTop: 40,
  },
  login: {
    color: '#e3750f',
  },
  authLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authLoaderText: {
    marginTop: 12,
    color: '#666',
  },
});
