import { View, Text, Modal } from 'react-native';
import { CheckCircle, AlertCircle, Loader, Database } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Button } from '@/components/ui/Button';
import type { SyncProgress } from '@/services/sync';
import type { ThemeColors } from '@/stores/ThemeContext';

const ENTITY_LABELS: Record<string, string> = {
  farms: 'Fazendas',
  field_plots: 'Talhões',
  farm_locations: 'Pastos e instalações',
  animal_lots: 'Lotes',
  animals: 'Animais',
  animal_breed_compositions: 'Raças',
};

const createStyles = (c: ThemeColors) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: c.neutral[0],
    borderRadius: 16,
    padding: spacing[6],
    width: '100%' as const,
    maxWidth: 360,
    gap: spacing[4],
  },
  header: {
    alignItems: 'center' as const,
    gap: spacing[3],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[800],
    textAlign: 'center' as const,
  },
  subtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    textAlign: 'center' as const,
  },
  entityList: {
    gap: spacing[3],
  },
  entityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
  },
  entityName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1,
  },
  entityCount: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  errorCount: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.error[500],
  },
});

interface SyncProgressOverlayProps {
  visible: boolean;
  progress: SyncProgress[];
  onDismiss: () => void;
}

export function SyncProgressOverlay({ visible, progress, onDismiss }: SyncProgressOverlayProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const allDone =
    progress.length > 0 && progress.every((p) => p.status === 'done' || p.status === 'error');
  const hasErrors = progress.some((p) => p.status === 'error');
  const totalSynced = progress.reduce((acc, p) => acc + p.count, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Database size={48} color={colors.primary[500]} aria-hidden />
            <Text style={styles.title} accessibilityRole="header">
              {allDone ? 'Sincronização concluída' : 'Sincronizando dados...'}
            </Text>
            <Text style={styles.subtitle}>
              {allDone
                ? `${totalSynced} registros sincronizados`
                : 'Baixando dados essenciais da fazenda'}
            </Text>
          </View>

          <View style={styles.entityList}>
            {progress.map((p) => (
              <View style={styles.entityRow} key={p.entity}>
                <StatusIcon status={p.status} colors={colors} />
                <Text style={styles.entityName}>{ENTITY_LABELS[p.entity] ?? p.entity}</Text>
                {p.status === 'done' && <Text style={styles.entityCount}>{p.count}</Text>}
                {p.status === 'error' && <Text style={styles.errorCount}>Erro</Text>}
              </View>
            ))}
          </View>

          {allDone && (
            <Button
              label={hasErrors ? 'Continuar mesmo assim' : 'Continuar'}
              onPress={onDismiss}
              accessibilityHint="Fecha o progresso de sincronização"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function StatusIcon({
  status,
  colors,
}: {
  status: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  switch (status) {
    case 'done':
      return <CheckCircle size={20} color={colors.primary[500]} aria-hidden />;
    case 'error':
      return <AlertCircle size={20} color={colors.error[500]} aria-hidden />;
    case 'syncing':
      return <Loader size={20} color={colors.sync.syncing} aria-hidden />;
    default:
      return <View style={{ width: 20, height: 20 }} />;
  }
}
