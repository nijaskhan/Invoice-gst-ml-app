import { paiseToRupeeLabel } from '@invoice-gst/shared';
import type { Invoice } from '@invoice-gst/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { invoiceDraftActions } from '../../store/slices/invoiceDraftSlice';
import { useAppDispatch } from '../../store';

export function InvoiceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<Invoice[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void repos.invoices.list().then((rows) => {
        if (active) {
          setItems(rows);
        }
      });
      return () => {
        active = false;
      };
    }, [repos]),
  );

  return (
    <Screen scroll={false}>
      <Title>Invoices</Title>
      <Button
        label="New invoice"
        onPress={() => {
          dispatch(invoiceDraftActions.resetDraft());
          navigation.navigate('InvoiceCreate');
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}>
            <Body style={{ fontWeight: '700' }}>{item.invoiceNumber}</Body>
            <Muted>
              {item.customerSnapshot.name} · {item.status} · {paiseToRupeeLabel(item.totalPaise)}
            </Muted>
          </Card>
        )}
        ListEmptyComponent={<Muted>No invoices yet. Create one offline.</Muted>}
      />
    </Screen>
  );
}
