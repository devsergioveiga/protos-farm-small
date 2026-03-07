import { View, Text } from 'react-native';
import { AlertTriangle, CheckCircle, FileWarning } from 'lucide-react-native';
import { spacing, fontSize, radius } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { OrgDashboardStats } from '@/types/dashboard';

interface AlertsSectionProps {
  alerts: OrgDashboardStats['alerts'] | null;
  isLoading: boolean;
}

const createStyles = (c: ThemeColors) => ({
  container: { paddingHorizontal: spacing[4] },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: c.neutral[800],
    marginBottom: spacing[3],
  },
  alertCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    backgroundColor: c.warning[100],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  alertText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[700],
    flex: 1 as const,
  },
  emptyContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  emptyText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
});

export function AlertsSection({ alerts, isLoading }: AlertsSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton width="30%" height={20} />
        <Skeleton width="100%" height={56} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const alertItems: Array<{ id: string; text: string }> = [];

  if (alerts) {
    if (alerts.farmLimit.warning) {
      alertItems.push({
        id: 'farm-limit',
        text: `Limite de fazendas: ${alerts.farmLimit.current}/${alerts.farmLimit.max} (${alerts.farmLimit.percentage}%)`,
      });
    }
    if (alerts.userLimit.warning) {
      alertItems.push({
        id: 'user-limit',
        text: `Limite de usuários: ${alerts.userLimit.current}/${alerts.userLimit.max} (${alerts.userLimit.percentage}%)`,
      });
    }
    if (alerts.expiringContracts.total > 0) {
      for (const contract of alerts.expiringContracts.alerts) {
        alertItems.push({
          id: `contract-${contract.producerName}`,
          text: `Contrato expirando: ${contract.producerName} em ${new Date(contract.expiresAt).toLocaleDateString('pt-BR')}`,
        });
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Alertas
      </Text>
      {alertItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckCircle size={16} color={colors.success[500]} aria-hidden />
          <Text style={styles.emptyText}>Nenhum alerta no momento</Text>
        </View>
      ) : (
        alertItems.map((alert) => (
          <View key={alert.id} style={styles.alertCard} accessibilityRole="alert">
            {alert.id.startsWith('contract') ? (
              <FileWarning size={20} color={colors.warning[500]} aria-hidden />
            ) : (
              <AlertTriangle size={20} color={colors.warning[500]} aria-hidden />
            )}
            <Text style={styles.alertText}>{alert.text}</Text>
          </View>
        ))
      )}
    </View>
  );
}
