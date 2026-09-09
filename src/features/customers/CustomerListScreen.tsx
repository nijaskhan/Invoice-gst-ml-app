import type { Customer } from '@invoice-gst/types';
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
import { stateLabel } from '../../constants/states';

export function CustomerListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const [items, setItems] = useState<Customer[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void repos.customers.list().then((rows) => {
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
      <Title>Customers</Title>
      <Button label="Add customer" onPress={() => navigation.navigate('CustomerForm', {})} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CustomerForm', { customerId: item.id })}>
            <Body style={{ fontWeight: '700' }}>{item.name}</Body>
            <Muted>
              {item.phone ?? 'No phone'} · {stateLabel(item.stateCode)}
            </Muted>
          </Card>
        )}
        ListEmptyComponent={<Muted>Walk-in invoices work without a customer.</Muted>}
      />
    </Screen>
  );
}
