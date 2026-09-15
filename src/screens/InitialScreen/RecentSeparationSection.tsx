import { FlatList, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SeparationJob } from "../../models/separations-jobs/SeparationJob";
import { deleteSeparationById } from "../../utils/separationStorage";
import { useTheme } from "../../utils/ThemeProvider";

type RootStackLikeParamList = {
  SourceSeparation: { id: string };
};

type Props = {
    jobs: SeparationJob[];
    onRefresh?: () => void;
    onViewAllPress?: () => void;
}

export default function RecentSeparationSection({ jobs, onRefresh, onViewAllPress }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackLikeParamList, 'SourceSeparation'>>();
  const handleDelete = async (id: string) => {
    await deleteSeparationById(id);
    onRefresh?.();
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No recent separations</Text>
    </View>
  );

  return(
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Recent separations</Text>
      </View>
      <FlatList 
      data={jobs}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({item}) => {
        const finished = item.finishedAt ? new Date(item.finishedAt).toDateString() : '-';
        return (
          <TouchableOpacity 
            style={[styles.item, { borderBottomColor: colors.borderColor }]}
            onPress={() => navigation.navigate('SourceSeparation', { id: item.id })}
          >
              <View style={styles.info}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{finished} • {String(item.option)}</Text>
              </View>
              <TouchableOpacity style={styles.deleteArea} onPress={() => handleDelete(item.id)} >
                <Text style={[styles.deleteText, { color: colors.error }]}>x</Text>
              </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
      />

      <TouchableOpacity
        style={styles.viewAllContainer}
        onPress={onViewAllPress}
        disabled={!onViewAllPress}
      >
        <Text style={[styles.viewAllText, !onViewAllPress && styles.viewAllTextDisabled, { color: colors.primary }]}>View All</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingLeft: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    letterSpacing: 0.2,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    color: "gray",
  },
  deleteArea: {
    paddingTop: 13,
    paddingRight: 15,
  },
  deleteText: {
    fontWeight: "bold",
  },
  container: {
    marginTop: 20,
    width: '95%',
    paddingHorizontal: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    // Color applied through inline style
  },
  viewAllContainer: {
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewAllTextDisabled: {
    opacity: 0.5,
  },
});