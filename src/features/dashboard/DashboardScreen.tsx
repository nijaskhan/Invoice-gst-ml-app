import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icon, type IconName } from '../../components/common/Icon';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { PressableScale } from '../../components/common/PressableScale';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { TabScreenNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useAppDispatch } from '../../store';
import { invoiceDraftActions } from '../../store/slices/invoiceDraftSlice';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { formatLongToday, formatTime, relativeDayLabel } from '../../utils/format';
import { InvoiceStatusBadge } from '../invoices/components/InvoiceStatusBadge';

const RECENT_COUNT = 5;

export function DashboardScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const styles = useThemedStyles(createStyles);

  const load = useCallback(async () => {
    const vendor = await repos.vendors.get();
    const invoices = await repos.invoices.list();
    const today = new Date().toISOString().slice(0, 10);
    const todays = invoices.filter(
      (invoice) => invoice.status === 'finalized' && invoice.createdAt.slice(0, 10) === today,
    );
    return {
      shopName: vendor?.businessName ?? 'My Shop',
      invoiceCount: invoices.filter((invoice) => invoice.status !== 'cancelled').length,
      todayTotal: todays.reduce((sum, invoice) => sum + invoice.totalPaise, 0),
      todayCount: todays.length,
      recent: invoices.slice(0, RECENT_COUNT),
    };
  }, [repos]);
  const query = useFocusedQuery(load);
  const data = query.data;

  function startInvoice() {
    dispatch(invoiceDraftActions.resetDraft());
    navigation.navigate('InvoiceCreate');
  }

  const todayCount = data?.todayCount ?? 0;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        eyebrow={formatLongToday()}
        title={data?.shopName ?? ' '}
        trailing={
          <View style={styles.offline} accessible accessibilityLabel="Works offline. Data is saved on this device.">
            <Icon name="phone-portrait-outline" size={14} tone="primaryText" />
            <Text variant="caption" tone="brand" style={styles.offlineLabel}>
              On device
            </Text>
          </View>
        }
      />

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text variant="label" tone="onHeroMuted">
            Today&apos;s sales
          </Text>
          <Amount paise={data?.todayTotal ?? 0} variant="display" tone="onHero" quietPaise />
          <Text variant="bodySmall" tone="onHeroMuted">
            {todayCount === 0
              ? 'No bills yet today'
              : `${todayCount} ${todayCount === 1 ? 'bill' : 'bills'} today`}
            {data ? ` · ${data.invoiceCount} in ledger` : ''}
          </Text>
        </View>
        <Button
          label="New invoice"
          icon="add"
          variant="inverse"
          size="large"
          onPress={startInvoice}
          accessibilityHint="Starts a new bill"
        />
      </View>

      <View style={styles.quickRow}>
        <QuickAction
          icon="cube-outline"
          label="Add product"
          onPress={() => navigation.navigate('ProductForm', {})}
        />
        <QuickAction
          icon="person-add-outline"
          label="Add customer"
          onPress={() => navigation.navigate('CustomerForm', {})}
        />
      </View>

      <Section
        title="Recent invoices"
        action={
          data && data.recent.length > 0
            ? { label: 'See all', onPress: () => navigation.navigate('Invoices') }
            : undefined
        }
        gap={0}
      >
        {query.status === 'loading' ? <SkeletonList rows={3} avatar={false} /> : null}
        {query.status === 'error' && !data ? (
          <ErrorState compact message={query.error} onRetry={query.reload} />
        ) : null}
        {data && data.recent.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="receipt-outline"
              title="Your ledger is empty"
              message="Your first bill is one tap away. It works without internet."
            />
          </Card>
        ) : null}
        {data?.recent.map((invoice, index) => (
          <ListItem
            key={invoice.id}
            title={invoice.customerSnapshot.name}
            subtitle={`${invoice.invoiceNumber} · ${relativeDayLabel(invoice.createdAt)}, ${formatTime(invoice.createdAt)}`}
            position={groupPosition(index, data.recent.length)}
            dimmed={invoice.status === 'cancelled'}
            onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id })}
            trailing={
              <>
                <Amount
                  paise={invoice.totalPaise}
                  variant="bodyMedium"
                  strike={invoice.status === 'cancelled'}
                />
                <InvoiceStatusBadge status={invoice.status} paymentStatus={invoice.paymentStatus} />
              </>
            }
          />
        ))}
      </Section>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.quick}
      pressedStyle={styles.quickPressed}
    >
      <View style={styles.quickIcon}>
        <Icon name={icon} tone="primaryText" />
      </View>
      <Text variant="label" numberOfLines={1} style={styles.quickLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    offline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[1],
      paddingHorizontal: space[2],
      paddingVertical: space[1],
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    offlineLabel: {
      fontWeight: '600',
    },
    hero: {
      gap: space[5],
      padding: space[5],
      borderRadius: radius.extraLarge,
      backgroundColor: colors.hero,
    },
    heroText: {
      gap: space[1],
    },
    quickRow: {
      flexDirection: 'row',
      gap: space[3],
    },
    quick: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      minHeight: 56,
      paddingHorizontal: space[3],
      borderRadius: radius.large,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    quickPressed: {
      backgroundColor: colors.surfaceSecondary,
    },
    quickIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    quickLabel: {
      flex: 1,
    },
  });
}
