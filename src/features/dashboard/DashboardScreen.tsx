import { paiseToRupeeLabel } from '@invoice-gst/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useDatabase } from '../../providers/DatabaseProvider';
import type { RootStackParamList } from '../../navigation/types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Screen } from '../../components/common/Screen';
import { invoiceDraftActions } from '../../store/slices/invoiceDraftSlice';
import { useAppDispatch } from '../../store';

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const [shopName, setShopName] = useState('My Shop');
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const vendor = await repos.vendors.get();
        const invoices = await repos.invoices.list();
        const today = new Date().toISOString().slice(0, 10);
        const todays = invoices.filter(
          (invoice) =>
            invoice.status === 'finalized' && invoice.createdAt.slice(0, 10) === today,
        );
        if (!active) {
          return;
        }
        setShopName(vendor?.businessName ?? 'My Shop');
        setInvoiceCount(invoices.filter((invoice) => invoice.status !== 'cancelled').length);
        setTodayTotal(todays.reduce((sum, invoice) => sum + invoice.totalPaise, 0));
      })();
      return () => {
        active = false;
      };
    }, [repos]),
  );

  return (
    <Screen>
      <Muted>Offline billing</Muted>
      <Title>{shopName}</Title>
      <Card>
        <Muted>Today</Muted>
        <Title>{paiseToRupeeLabel(todayTotal)}</Title>
        <Body>{invoiceCount} invoices in the local ledger</Body>
      </Card>
      <View style={{ gap: 12 }}>
        <Button
          label="New invoice"
          onPress={() => {
            dispatch(invoiceDraftActions.resetDraft());
            navigation.navigate('InvoiceCreate');
          }}
        />
        <Button
          label="Add product"
          variant="secondary"
          onPress={() => navigation.navigate('ProductForm', {})}
        />
      </View>
    </Screen>
  );
}
