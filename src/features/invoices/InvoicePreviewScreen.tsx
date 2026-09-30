import {
  getFinancialYear,
  quantityMilliToText,
  resolvePlaceOfSupply,
} from '@invoice-gst/shared';
import type { GstConfiguration, PaymentMethod, Vendor } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { DashedRule, Divider } from '../../components/common/Divider';
import { Screen } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SkeletonBlock, SkeletonGroup } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { SwitchRow } from '../../components/common/SwitchRow';
import { TextField } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import { stateLabel } from '../../constants/states';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { paymentStatusForDraft, totalsFromDraft } from '../../services/invoice/draftTotals';
import { useAppDispatch, useAppSelector } from '../../store';
import { invoiceDraftActions, type InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';
import { space } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatRupees, paymentMethodLabel } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import { TotalsSummary } from './components/TotalsSummary';

const PAYMENT_METHODS = (['cash', 'upi', 'card'] as const satisfies readonly PaymentMethod[]).map(
  (value) => ({ value, label: paymentMethodLabel[value] }),
);

type LoadState = 'loading' | 'ready' | 'error';

export function InvoicePreviewScreen() {
  const navigation = useNavigation<StackNavigation>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const liveDraft = useAppSelector((state) => state.invoiceDraft);
  // After saving, the draft is reset while this screen animates away; keep
  // showing what was saved rather than flashing an empty bill.
  const [savedDraft, setSavedDraft] = useState<InvoiceDraftState | null>(null);
  const draft = savedDraft ?? liveDraft;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [config, setConfig] = useState<GstConfiguration | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentVendor = await repos.vendors.get();
        const currentConfig = currentVendor
          ? await repos.vendors.getGstConfig(currentVendor.id)
          : null;
        if (!active) {
          return;
        }
        setVendor(currentVendor);
        setConfig(currentConfig);
        setLoadState('ready');
      } catch (error) {
        if (active) {
          setLoadError(errorMessage(error));
          setLoadState('error');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [repos, attempt]);

  const totals = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return totalsFromDraft(draft, vendor, config);
  }, [config, draft, vendor]);

  async function onSave() {
    if (!vendor || !totals || draft.lines.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const place = resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode);
      const paymentStatus = paymentStatusForDraft(draft, totals.totalPaise);
      const invoice = await repos.invoices.finalize({
        vendorId: vendor.id,
        prefix: vendor.invoicePrefix,
        invoice: {
          financialYear: getFinancialYear(),
          customerId: draft.customerId,
          customerSnapshot: draft.customerSnapshot,
          placeOfSupplyStateCode: place.placeOfSupplyStateCode,
          isInterState: place.isInterState,
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          taxablePaise: totals.taxablePaise,
          cgstPaise: totals.cgstPaise,
          sgstPaise: totals.sgstPaise,
          igstPaise: totals.igstPaise,
          roundOffPaise: totals.roundOffPaise,
          totalPaise: totals.totalPaise,
          paymentStatus,
          notes: draft.notes || null,
        },
        items: draft.lines.map((line, index) => {
          const lineTotals = totals.lines[index];
          return {
            productId: line.productId,
            productNameSnapshot: line.productName,
            localNameSnapshot: line.localName,
            hsnSnapshot: line.hsnCode,
            unitSnapshot: line.unit,
            quantityMilli: line.quantityMilli,
            unitPricePaise: line.unitPricePaise,
            gstRateBps: line.gstRateBps,
            priceInclusive: line.priceInclusive,
            taxablePaise: lineTotals?.taxablePaise ?? 0,
            cgstPaise: lineTotals?.cgstPaise ?? 0,
            sgstPaise: lineTotals?.sgstPaise ?? 0,
            igstPaise: lineTotals?.igstPaise ?? 0,
            lineTotalPaise: lineTotals?.lineTotalPaise ?? 0,
          };
        }),
        payment: draft.collectPayment
          ? { method: draft.paymentMethod, amountPaise: totals.totalPaise }
          : undefined,
      });
      haptics.success();
      toast.success(`Invoice ${invoice.invoiceNumber} saved`);
      setSavedDraft(draft);
      dispatch(invoiceDraftActions.resetDraft());
      navigation.replace('InvoiceDetail', { invoiceId: invoice.id });
    } catch (error) {
      haptics.error();
      toast.error(`Couldn't save the invoice. ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <Screen>
        <PreviewSkeleton />
      </Screen>
    );
  }

  if (loadState === 'error') {
    return (
      <Screen>
        <ErrorState
          title="Couldn't load your shop profile"
          message={loadError ?? undefined}
          onRetry={() => {
            setLoadState('loading');
            setAttempt((value) => value + 1);
          }}
        />
      </Screen>
    );
  }

  if (!vendor || !totals) {
    return (
      <Screen>
        <EmptyState
          icon="storefront-outline"
          title="Add your shop details first"
          message="Invoices need your business name and state to work out GST."
          action={{
            label: 'Open shop settings',
            onPress: () => navigation.navigate('Tabs', { screen: 'Settings' }),
          }}
        />
      </Screen>
    );
  }

  if (draft.lines.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="basket-outline"
          title="This bill has no items"
          message="Go back and add at least one product to review the invoice."
          action={{ label: 'Back to bill', icon: 'arrow-back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const place = resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode);
  const customerMeta = [draft.customerSnapshot.phone, draft.customerSnapshot.gstin]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      keyboard
      footer={
        <>
          <Button
            label={`Save invoice · ${formatRupees(totals.totalPaise)}`}
            icon="checkmark"
            size="large"
            onPress={() => void onSave()}
            loading={saving}
            accessibilityHint="Saves the invoice on this device and assigns the next number"
          />
          <Text variant="caption" tone="tertiary" align="center">
            Saved on this device. You can share it as a PDF next.
          </Text>
        </>
      }
    >
      <Card style={styles.paper}>
        <View style={styles.paperHeader}>
          <View style={styles.flex}>
            <Text variant="h3" numberOfLines={2}>
              {vendor.tradeName || vendor.businessName}
            </Text>
            <Text variant="caption" tone="secondary">
              {vendor.gstin ? `GSTIN ${vendor.gstin}` : 'Unregistered'}
            </Text>
          </View>
          <Badge label="Preview" tone="neutral" />
        </View>

        <Divider />

        <View style={styles.partyRow}>
          <View style={styles.flex}>
            <Text variant="caption" tone="tertiary">
              Bill to
            </Text>
            <Text variant="bodyMedium">{draft.customerSnapshot.name}</Text>
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
              {stateLabel(place.placeOfSupplyStateCode)}
            </Text>
            <Text variant="caption" tone={place.isInterState ? 'info' : 'secondary'} align="right">
              {place.isInterState ? 'Inter-state · IGST' : 'Intra-state · CGST + SGST'}
            </Text>
          </View>
        </View>

        <Divider />

        <View style={styles.items}>
          {draft.lines.map((line, index) => (
            <View key={line.key} style={styles.itemRow}>
              <View style={styles.flex}>
                <Text variant="bodyMedium" numberOfLines={2}>
                  {line.productName}
                </Text>
                <Text variant="caption" tone="secondary" tabular>
                  {quantityMilliToText(line.quantityMilli)} {line.unit} × {formatRupees(line.unitPricePaise)}
                  {' · '}
                  {line.gstRateBps / 100}% GST{line.priceInclusive ? ' incl.' : ''}
                </Text>
              </View>
              <Amount paise={totals.lines[index]?.lineTotalPaise ?? 0} variant="bodyMedium" />
            </View>
          ))}
        </View>

        <DashedRule />

        <TotalsSummary totals={totals} isInterState={place.isInterState} />
      </Card>

      <Section title="Payment">
        <Card>
          <SwitchRow
            label="Payment received"
            description={
              draft.collectPayment
                ? 'The invoice is marked paid in full.'
                : 'The invoice is saved as unpaid.'
            }
            value={draft.collectPayment}
            onValueChange={(value) => dispatch(invoiceDraftActions.setCollectPayment(value))}
          />
          {draft.collectPayment ? (
            <View style={styles.method}>
              <SegmentedControl
                accessibilityLabel="Payment method"
                segments={PAYMENT_METHODS}
                value={draft.paymentMethod === 'credit' ? 'cash' : draft.paymentMethod}
                onChange={(value) => dispatch(invoiceDraftActions.setPaymentMethod(value))}
              />
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Notes">
        <TextField
          label="Note on invoice"
          optional
          multiline
          value={draft.notes}
          onChangeText={(value) => dispatch(invoiceDraftActions.setNotes(value))}
          placeholder="e.g. Delivered to shop, thank you!"
        />
      </Section>
    </Screen>
  );
}

function PreviewSkeleton() {
  return (
    <SkeletonGroup style={styles.skeleton}>
      <SkeletonBlock width="55%" height={20} />
      <SkeletonBlock width="35%" height={12} />
      <SkeletonBlock height={1} style={styles.skeletonGap} />
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.itemRow}>
          <View style={[styles.flex, styles.skeletonLines]}>
            <SkeletonBlock width="60%" />
            <SkeletonBlock width="40%" height={10} />
          </View>
          <SkeletonBlock width={64} />
        </View>
      ))}
      <SkeletonBlock height={28} style={styles.skeletonGap} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  paper: {
    gap: space[4],
    padding: space[5],
  },
  paperHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  flex: {
    flex: 1,
    gap: 2,
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
  items: {
    gap: space[3],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  method: {
    marginTop: space[3],
  },
  skeleton: {
    gap: space[3],
  },
  skeletonLines: {
    gap: space[2],
  },
  skeletonGap: {
    marginVertical: space[2],
  },
});
