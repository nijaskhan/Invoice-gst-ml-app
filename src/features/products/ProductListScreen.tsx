import { paiseToRupeeLabel } from '@invoice-gst/shared';
import type { Product } from '@invoice-gst/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { useDatabase } from '../../providers/DatabaseProvider';
import type { RootStackParamList } from '../../navigation/types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Screen } from '../../components/common/Screen';

export function ProductListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const [items, setItems] = useState<Product[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void repos.products.list().then((rows) => {
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
      <Title>Products</Title>
      <Button label="Add product" onPress={() => navigation.navigate('ProductForm', {})} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('ProductForm', { productId: item.id })}>
            <Body style={{ fontWeight: '700' }}>{item.name}</Body>
            <Muted>
              {item.localName ? `${item.localName} · ` : ''}
              {paiseToRupeeLabel(item.sellingPricePaise)} / {item.unit} · {item.gstRateBps / 100}% GST
            </Muted>
          </Card>
        )}
        ListEmptyComponent={<Muted>No products yet.</Muted>}
      />
    </Screen>
  );
}
