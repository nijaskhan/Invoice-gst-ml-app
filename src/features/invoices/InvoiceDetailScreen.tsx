import { paiseToRupeeLabel, quantityMilliToText } from '@invoice-gst/shared';
import type { InvoiceWithItems } from '@invoice-gst/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { errorMessage } from '../../utils/errors';

export function InvoiceDetailScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>) {
  const { repos } = useDatabase();
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);

  const load = useCallback(async () => {
    setInvoice(await repos.invoices.getWithItems(route.params.invoiceId));
  }, [repos, route.params.invoiceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCancel() {
    try {
      await repos.invoices.cancel(route.params.invoiceId);
      await load();
    } catch (error) {
      Alert.alert('Cannot cancel', errorMessage(error));
    }
  }

  if (!invoice) {
    return (
      <Screen>
        <Muted>Invoice not found.</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{invoice.invoiceNumber}</Title>
      <Muted>
        {invoice.status} · {invoice.paymentStatus} · {invoice.customerSnapshot.name}
      </Muted>
      {invoice.items.map((item) => (
        <Card key={item.id}>
          <Body style={{ fontWeight: '700' }}>{item.productNameSnapshot}</Body>
          <Muted>
            {quantityMilliToText(item.quantityMilli)} {item.unitSnapshot} ·{' '}
            {paiseToRupeeLabel(item.lineTotalPaise)}
          </Muted>
        </Card>
      ))}
      <Card>
        <Muted>Taxable {paiseToRupeeLabel(invoice.taxablePaise)}</Muted>
        <Muted>CGST {paiseToRupeeLabel(invoice.cgstPaise)}</Muted>
        <Muted>SGST {paiseToRupeeLabel(invoice.sgstPaise)}</Muted>
        <Muted>IGST {paiseToRupeeLabel(invoice.igstPaise)}</Muted>
        <Body style={{ fontWeight: '700' }}>Total {paiseToRupeeLabel(invoice.totalPaise)}</Body>
      </Card>
      {invoice.status === 'finalized' ? (
        <Button label="Cancel invoice" variant="danger" onPress={() => void onCancel()} />
      ) : null}
    </Screen>
  );
}
