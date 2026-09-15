import { Modal, StyleSheet, View, TouchableOpacity, Text, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import Card from './Card';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';
import { pickAudioFile, submitSeparationRequest } from '../../utils/pickDocument';
import { SeparationOption } from '../../models/separations-jobs/SeparationOption';
import { DocumentPickerAsset } from 'expo-document-picker';
import { useSeparationWatcherController } from '../../utils/SeparationWatcherProvider';
import RecentSeparationSection from './RecentSeparationSection';
import { getAllSeparations } from '../../services/clientService';
import { SeparationJob } from '../../models/separations-jobs/SeparationJob';
import { fetchSeparationMetaData, getSeparations } from '../../utils/separationStorage';
import { clearClient, getClient } from '../../utils/clientStorage';
import { clearTokens, getRefreshToken } from '../../utils/authStorage';
import { LogoutRequest } from '../../models/auth/LogoutRequest';
import { logout } from '../../services/authService';
import { useTheme } from '../../utils/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Initial'>;


export default function InitialScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [expandedCard, setExpandedCard] = useState<"EDITOR" | "SEPARATION" | null>(null);
  const { setWatchJobId, watchStatus } = useSeparationWatcherController();
  const [jobs, setJobs] = useState<SeparationJob[]>([]);

  const [modalOptionVisible, setModalOptionVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [separationOption, setSeparationOption] = useState<SeparationOption | null>(null);
  const [separationAction, setSeparationAction] = useState<'browse' | 'record' | null>(null);

  const navigation = useNavigation<NavigationProp>();

  const fetchJobs = async() => {
      const separations = await getSeparations();
      const recent = [...separations].sort(
        (s1, s2) => new Date(s2.finishedAt).getTime() - new Date(s1.finishedAt).getTime()
      ).slice(0, 3);
      setJobs(recent);
    };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (watchStatus === 'DONE') {
      void fetchJobs();
    }
  }, [watchStatus]);

  const handleOptionPress = async () => {
    setSeparationAction('browse');
    setModalOptionVisible(true);
  };

  const handleOptionSelection = async (option: SeparationOption) => {
    setModalOptionVisible(false);
    setSeparationOption(option);

    if (separationAction === 'record') {
      navigation.replace('Recorder', { nextScreen: 'separation', separationType: option })
      return;
    }

    await handleUpload(option);
  };

  const handleRecordForSeparation = async() => {
    setSeparationAction('record');
    setModalOptionVisible(true);
  }

  const handleLogout = async () => {
    try {
      const token = await getRefreshToken();
      const client = await getClient();

      if (token && client) {
        const request: LogoutRequest = {
          clientId: client.id,
          refreshToken: token,
        };
        await logout(request);
      }

      await clearTokens();
      await clearClient();
      setDrawerVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      console.error('Logout failed:', error);
      await clearTokens();
      await clearClient();
      setDrawerVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const handleUpload = async (optionParam?: SeparationOption) => {
      try {
      setWatchJobId(null);
      const file = await pickAudioFile();
      if(file) {
        const safeName = file.name || `song-${Date.now()}.mp3`;
        const dest = FileSystem.documentDirectory + safeName;
        await FileSystem.copyAsync({
          from: file.uri,
          to: dest
        });
        const usedOption = optionParam ?? SeparationOption.FOUR_STEMS;
        console.log("Sending separation request:", { name: safeName, uri: dest, size: file.size, type: file.mimeType });
        const response = await submitSeparationRequest({
          uri: dest,
          name: safeName,
          mimeType: file.mimeType,
        }, usedOption);
        if (response) {
          setWatchJobId(response.jobId);
          console.log("Upload response: ", response);
        }
      }
      } catch(err) {
        console.error("Greška u pickAudioFile:", err); 
      }
    }

  return (
    <SafeAreaView  style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.menuContainer,
        {
          top: insets.top + 10,
        },
      ]}
      >
        <TouchableOpacity onPress={() => setDrawerVisible(true)}>
          <SimpleLineIcons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <Card
        color="#4f90ff"
        title="EDITOR"
        description="Trim, volume, EQ, delay..."
        icon={<MaterialCommunityIcons name="waveform" style={styles.optionTitleIcon} />}
        expanded={expandedCard === 'EDITOR'}
        onPress={() => setExpandedCard(expandedCard === 'EDITOR' ? null : 'EDITOR')}
        onBrowseFile={async () => {
          const file = await pickAudioFile();
          if(file) {
            const safeName = file.name || `editor-${Date.now()}.wav`;
            const dest = FileSystem.documentDirectory + safeName;

            await FileSystem.copyAsync({
              from: file.uri,
              to: dest,
            });

            console.log(`Izabrani audio fajl: ${file}`);
            navigation.navigate('EditorScreen', { path: dest });
          }
        }}
        onRecord={async () => {
          navigation.replace('Recorder', { nextScreen: 'editor', separationType: SeparationOption.FOUR_STEMS })
        }}
      />

      <Card
        color="#FF903C"
        title="SOURCE SEPARATION"
        description="Separate song into vocals, drums, bass and other."
        icon={<MaterialIcons name="call-split" style={styles.optionTitleIcon} />}
        expanded={expandedCard === 'SEPARATION'}
        onPress={() => setExpandedCard(expandedCard === 'SEPARATION' ? null : 'SEPARATION')}
        onBrowseFile={handleOptionPress}
        onRecord={handleRecordForSeparation}
        isLoading={watchStatus !== null && watchStatus !== 'DONE' && watchStatus !== 'FAILED'}
      />

      <RecentSeparationSection 
        jobs={jobs} 
        onRefresh={fetchJobs}
        onViewAllPress={() => navigation.navigate('AllSeparations')}
      />

      <Modal
        visible={modalOptionVisible}
        transparent={true}
        animationType='slide'
        onRequestClose={() => setModalOptionVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setModalOptionVisible(false)}
              style={styles.closeButton}
              hitSlop={10}
            >
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Separation type</Text>
            <TouchableOpacity onPress={() => handleOptionSelection(SeparationOption.VOCALS)}>
              <Text style={styles.option}>VOCALS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleOptionSelection(SeparationOption.FOUR_STEMS)}>
              <Text style={styles.option}>FOUR STEMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={drawerVisible}
        transparent={true}
        animationType='fade'
        onRequestClose={() => setDrawerVisible(false)}
      >
        <SafeAreaView style={styles.drawerOverlay} edges={['top', 'right']}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setDrawerVisible(false)}
          />
          <View style={[styles.drawerPanel, { backgroundColor: colors.drawerBackground }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>Menu</Text>
              <TouchableOpacity onPress={() => setDrawerVisible(false)} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: colors.menuItemBackground }]} onPress={() => navigation.navigate('Settings')}>
              <MaterialIcons name="settings" size={22} color={colors.primary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: colors.menuItemBackground }]} onPress={() => navigation.navigate('Account')}>
              <MaterialIcons name="person" size={22} color={colors.secondary} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: colors.menuItemBackground }]} onPress={() => setExpandedCard(null)}>
              <MaterialIcons name="restart-alt" size={22} color={colors.accent} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>Reset cards</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: colors.menuItemBackground }]} onPress={handleLogout}>
              <MaterialIcons name="logout" size={22} color={colors.error} />
              <Text style={[styles.drawerItemText, { color: colors.textPrimary }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  menuContainer: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 2,
  },
  optionTitleIcon: {
    fontSize: 34,
    color: 'white',
  },

  item: { padding: 12, borderBottomWidth: 1, borderColor: "#ddd" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    width: "80%",
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  option: { fontSize: 16, marginVertical: 8 },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerPanel: {
    width: '78%',
    maxWidth: 340,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: 0 },
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
