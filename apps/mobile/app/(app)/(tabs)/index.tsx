import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sprout } from 'lucide-react-native';
import { colors, spacing, fontSize } from '@protos-farm/shared';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { selectedFarm } = useFarmContext();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Sprout size={32} color={colors.primary[600]} aria-hidden />
          <Text style={styles.title} accessibilityRole="header">
            Protos Farm
          </Text>
        </View>

        {selectedFarm && (
          <View style={styles.farmInfo}>
            <Text style={styles.farmLabel}>Fazenda ativa</Text>
            <Text style={styles.farmName}>{selectedFarm.name}</Text>
            {selectedFarm.city && (
              <Text style={styles.farmDetail}>
                {selectedFarm.city}/{selectedFarm.state}
              </Text>
            )}
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>Logado como</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.footer}>
          <Button
            label="Sair"
            onPress={() => void logout()}
            variant="secondary"
            accessibilityHint="Encerra sua sessão"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: colors.neutral[800],
  },
  farmInfo: {
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  farmLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  farmName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: colors.neutral[800],
    marginTop: spacing[1],
  },
  farmDetail: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  userInfo: {
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  userLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  userEmail: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: colors.neutral[700],
    marginTop: spacing[1],
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing[6],
  },
});
