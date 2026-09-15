import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAllSeparations } from '../../services/clientService';
import { getClientId } from '../../utils/clientStorage';
import { SeparationJob } from '../../models/separations-jobs/SeparationJob';
import { deleteSeparationById } from '../../utils/separationStorage';
import { useTheme } from '../../utils/ThemeProvider';

export default function AllSeparationsScreen() {
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<SeparationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const clientId = await getClientId();
      if (!clientId) {
        setJobs([]);
        return;
      }

      const data = await getAllSeparations(clientId);
      const sortedData = data.sort(
        (d1, d2) => new Date(d2.finishedAt).getTime() - new Date(d1.finishedAt).getTime()
      );
      setJobs(sortedData);
    } catch (error) {
      console.error('Greška pri dohvaćanju svih separacija:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchJobs();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteSeparationById(id);
    await fetchJobs();
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No separations yet</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>All separations</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={jobs.length === 0 ? styles.emptyList : styles.listContent}
          renderItem={({ item }) => {
            const finished = item.finishedAt ? new Date(item.finishedAt).toDateString() : '-';
            return (
              <TouchableOpacity 
                style={[styles.item, { borderBottomColor: colors.borderColor }]}
                onPress={() => console.log(item.id)}
              >
                <View style={styles.info}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{finished} • {String(item.option)}</Text>
                </View>
                <TouchableOpacity style={styles.deleteArea} onPress={() => handleDelete(item.id)}>
                  <Text style={[styles.deleteText, { color: colors.error }]}>x</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  info: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  deleteArea: {
    paddingTop: 13,
    paddingRight: 15,
    paddingLeft: 12,
  },
  deleteText: {
    fontWeight: 'bold',
  },
});
