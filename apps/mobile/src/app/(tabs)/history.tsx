import type { PaginatedResponse } from '@teranga-fleet/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatKm } from '@/lib/format';
import { keys } from '@/lib/queries';
import type { MileageLog } from '@/lib/types';
import { colors } from '@/theme';

export default function HistoryScreen() {
  const history = useInfiniteQuery({
    queryKey: keys.mileage,
    queryFn: ({ pageParam }) =>
      api<PaginatedResponse<MileageLog>>('drivers/me/mileage', {
        query: { page: pageParam, limit: 20 },
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
  const logs = history.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Screen
      refreshing={history.isRefetching && !history.isFetchingNextPage}
      onRefresh={() => void history.refetch()}
    >
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <ErrorBanner error={history.error} />
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            icon="speedometer-outline"
            title="Aucun relevé"
            description="Vos relevés kilométriques apparaîtront ici."
          />
        </Card>
      ) : (
        <Card style={styles.list}>
          {logs.map((log, index) => (
            <View key={log.id} style={[styles.item, index > 0 && styles.separator]}>
              <View style={styles.flex}>
                <Text style={styles.km}>{formatKm(log.kilometrage)}</Text>
                <Text style={styles.meta}>{log.vehicle.immatriculation}</Text>
              </View>
              <Text style={styles.meta}>{formatDateTime(log.date)}</Text>
            </View>
          ))}
        </Card>
      )}
      {history.hasNextPage && (
        <Button
          title="Voir plus"
          variant="secondary"
          loading={history.isFetchingNextPage}
          onPress={() => void history.fetchNextPage()}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4, gap: 0 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  flex: { flex: 1 },
  km: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
