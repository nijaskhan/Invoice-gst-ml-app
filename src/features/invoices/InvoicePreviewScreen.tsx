import {
  getFinancialYear,
  paiseToRupeeLabel,
  resolvePlaceOfSupply,
} from '@invoice-gst/shared';
import type { GstConfiguration, Vendor } from '@invoice-gst/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { paymentStatusForDraft, totalsFromDraft } from '../../services/invoice/draftTotals';
import { invoiceDraftActions } from '../../store/slices/invoiceDraftSlice';
import { useAppDispatch, useAppSelector } from '../../store';
import { errorMessage } from '../../utils/errors';

export function InvoicePreviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const draft = useAppSelector((state) => state.invoiceDraft);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [config, setConfig] = useState<GstConfiguration | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const currentVendor = await repos.vendors.get();
      setVendor(currentVendor);
      if (currentVendor) {
        setConfig(await repos.vendors.getGstConfig(currentVendor.id));
      }
    })();
  }, [repos]);

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
      dispatch(invoiceDraftActions.resetDraft());
      navigation.replace('InvoiceDetail', { invoiceId: invoice.id });
    } catch (error) {
      Alert.alert('Could not save invoice', errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!totals) {
    return (
      <Screen>
        <Muted>Loading shop profile…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Preview</Title>
      <Card>
        <Body style={{ fontWeight: '700' }}>{draft.customerSnapshot.name}</Body>
        {draft.lines.map((line) => (
          <Muted key={line.key}>
            {line.productName} × {line.quantityMilli / 1000} {line.unit}
          </Muted>
        ))}
        <Muted>Taxable {paiseToRupeeLabel(totals.taxablePaise)}</Muted>
        <Muted>CGST {paiseToRupeeLabel(totals.cgstPaise)}</Muted>
        <Muted>SGST {paiseToRupeeLabel(totals.sgstPaise)}</Muted>
        <Muted>IGST {paiseToRupeeLabel(totals.igstPaise)}</Muted>
        <Body style={{ fontWeight: '700' }}>Total {paiseToRupeeLabel(totals.totalPaise)}</Body>
      </Card>
      <Button label="Save to this device" onPress={() => void onSave()} loading={saving} />
    </Screen>
  );
}
