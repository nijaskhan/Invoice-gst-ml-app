import { quantityMilliToText } from '@invoice-gst/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ConfirmSheet } from '../../components/common/ConfirmSheet';
import { Divider } from '../../components/common/Divider';
import { Icon } from '../../components/common/Icon';
import { Screen } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SkeletonBlock, SkeletonGroup } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useToast } from '../../components/common/Toast';
import { stateLabel } from '../../constants/states';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { shareInvoicePdf } from '../../services/pdf/shareInvoicePdf';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatDateTime, formatRupees, paymentMethodLabel } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import { InvoiceStatusBadge } from './components/InvoiceStatusBadge';
import { TotalsSummary } from './components/TotalsSummary';

export function InvoiceDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>) {
  const { repos } = useDatabase();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [sharing, setSharing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(
    () => repos.invoices.getWithItems(route.params.invoiceId),
    [repos, route.params.invoiceId],
  );
  const query = useFocusedQuery(load);
  const invoice = query.data ?? null;

  async function onShare() {
    if (!invoice) {
      return;
    }
    setSharing(true);
    try {
      const vendor = await repos.vendors.get();
      if (!vendor) {
        throw new Error('Save the shop profile before sharing a PDF');
      }
      await shareInvoicePdf({ vendor, invoice });
    } catch (error) {
      toast.error(`Couldn't share the PDF. ${errorMessage(error)}`);
    } finally {
      setSharing(false);
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await repos.invoices.cancel(route.params.invoiceId);
      haptics.warning();
      toast.info('Invoice cancelled');
      setConfirmingCancel(false);
      query.reload();
    } catch (error) {
      toast.error(`Couldn't cancel. ${errorMessage(error)}`);
    } finally {
      setCancelling(false);
    }
  }

  if (query.status === 'loading') {
    return (
      <Screen>
        <DetailSkeleton />
      </Screen>
    );
  }

  if (query.status === 'error' && !invoice) {
    return (
      <Screen>
        <ErrorState title="Couldn't open this invoice" message={query.error} onRetry={query.reload} />
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen>
        <EmptyState
          icon="document-outline"
          title="Invoice not found"
          message="It may have been removed from this device."
          action={{ label: 'Go back', icon: 'arrow-back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const cancelled = invoice.status === 'cancelled';
  const customerMeta = [invoice.customerSnapshot.phone, invoice.customerSnapshot.gstin]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button
            label="Share PDF"
            icon="share-outline"
            onPress={() => void onShare()}
            loading={sharing}
            style={styles.primaryAction}
          />
          {invoice.status === 'finalized' ? (
            <Button
              label="Cancel"
              variant="danger"
              icon="close-circle-outline"
              onPress={() => setConfirmingCancel(true)}
              accessibilityHint="Asks for confirmation before cancelling"
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text variant="label" tone="secondary" tabular selectable>
            {invoice.invoiceNumber}
          </Text>
          <InvoiceStatusBadge status={invoice.status} paymentStatus={invoice.paymentStatus} />
        </View>
        <Amount paise={invoice.totalPaise} variant="display" quietPaise strike={cancelled} />
        <Text variant="bodySmall" tone="secondary">
          {formatDateTime(invoice.finalizedAt ?? invoice.createdAt)}
        </Text>
      </View>

      {cancelled ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Icon name="ban-outline" size="small" tone="error" />
          <Text variant="bodySmall" tone="error" style={styles.bannerText}>
            This invoice was cancelled. It stays in your ledger for GST records.
          </Text>
        </View>
      ) : null}

      <Card>
        <View style={styles.partyRow}>
          <View style={styles.flex}>
            <Text variant="caption" tone="tertiary">
              Bill to
            </Text>
            <Text variant="bodyMedium">{invoice.customerSnapshot.name}</Text>
            {customerMeta ? (
              <Text variant="caption" tone="secondary">
                {customerMeta}
              </Text>
            ) : null}
          </View>
          <View style={styles.placeColumn}>
            <Text variant="caption" tone="tertiary" align="right">
              Place of supply
            </Text>
            <Text variant="bodySmall" align="right">
              {stateLabel(invoice.placeOfSupplyStateCode)}
            </Text>
          </View>
        </View>
      </Card>

      <Section title="Items" description={`${invoice.items.length} ${invoice.items.length === 1 ? 'line' : 'lines'}`}>
        <Card>
          <View style={styles.items}>
            {invoice.items.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider style={styles.itemDivider} /> : null}
                <View style={styles.itemRow}>
                  <View style={styles.flex}>
                    <Text variant="bodyMedium" numberOfLines={2}>
                      {item.productNameSnapshot}
                    </Text>
                    <Text variant="caption" tone="secondary" tabular>
                      {quantityMilliToText(item.quantityMilli)} {item.unitSnapshot} ×{' '}
                      {formatRupees(item.unitPricePaise)} · {item.gstRateBps / 100}% GST
                      {item.hsnSnapshot ? ` · HSN ${item.hsnSnapshot}` : ''}
                    </Text>
                  </View>
                  <Amount paise={item.lineTotalPaise} variant="bodyMedium" />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.totals}>
            <TotalsSummary totals={invoice} isInterState={invoice.isInterState} cancelled={cancelled} />
          </View>
        </Card>
      </Section>

      {invoice.payments.length > 0 ? (
        <Section title="Payments">
          <Card>
            {invoice.payments.map((payment, index) => (
              <View key={payment.id}>
                {index > 0 ? <Divider style={styles.itemDivider} /> : null}
                <View style={styles.itemRow}>
                  <Icon name="checkmark-circle-outline" tone="success" />
                  <View style={styles.flex}>
                    <Text variant="bodyMedium">{paymentMethodLabel[payment.method]}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatDateTime(payment.paidAt)}
                    </Text>
                  </View>
                  <Amount paise={payment.amountPaise} variant="bodyMedium" />
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {invoice.notes ? (
        <Section title="Note">
          <Text variant="body" tone="secondary">
            {invoice.notes}
          </Text>
        </Section>
      ) : null}

      <ConfirmSheet
        visible={confirmingCancel}
        title={`Cancel ${invoice.invoiceNumber}?`}
        message="The invoice will be marked as cancelled and kept in your ledger for GST records. This can't be undone, and the number won't be reused."
        confirmLabel="Cancel invoice"
        destructive
        loading={cancelling}
        onConfirm={() => void onCancel()}
        onCancel={() => setConfirmingCancel(false)}
      />
    </Screen>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonGroup style={skeletonStyles.wrap}>
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="65%" height={40} />
      <SkeletonBlock width="35%" height={12} />
      <SkeletonBlock height={72} rounded={radius.large} style={skeletonStyles.gap} />
      <SkeletonBlock height={180} rounded={radius.large} />
    </SkeletonGroup>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { gap: space[3] },
  gap: { marginTop: space[3] },
});

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: space[3],
    },
    primaryAction: {
      flex: 1,
    },
    hero: {
      gap: space[2],
      paddingTop: space[2],
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      padding: space[3],
      borderRadius: radius.medium,
      backgroundColor: colors.errorSoft,
    },
    bannerText: {
      flex: 1,
    },
    partyRow: {
      flexDirection: 'row',
      gap: space[4],
    },
    placeColumn: {
      alignItems: 'flex-end',
      gap: 2,
      maxWidth: '48%',
    },
    flex: {
      flex: 1,
      gap: 2,
    },
    items: {
      gap: space[3],
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
    },
    itemDivider: {
      marginBottom: space[3],
    },
    totals: {
      marginTop: space[4],
      paddingTop: space[4],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
  });
}
