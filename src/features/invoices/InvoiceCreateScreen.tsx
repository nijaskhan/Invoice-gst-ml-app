import {
  paiseToRupeeLabel,
  quantityMilliToText,
  quantityTextToMilli,
  rupeesTextToPaise,
} from '@invoice-gst/shared';
import type { Customer, Product, Vendor } from '@invoice-gst/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body, Muted, Title } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { totalsFromDraft } from '../../services/invoice/draftTotals';
import { invoiceDraftActions } from '../../store/slices/invoiceDraftSlice';
import { useAppDispatch, useAppSelector } from '../../store';
import { colors, radius, space } from '../../theme/theme';

export function InvoiceCreateScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const draft = useAppSelector((state) => state.invoiceDraft);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [discountText, setDiscountText] = useState('0');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        repos.products.listActive(),
        repos.customers.list(),
        repos.vendors.get(),
      ]).then(([productRows, customerRows, vendorRow]) => {
        if (!active) {
          return;
        }
        setProducts(productRows);
        setCustomers(customerRows);
        setVendor(vendorRow);
      });
      return () => {
        active = false;
      };
    }, [repos]),
  );

  const totals = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return totalsFromDraft(draft, vendor, null);
  }, [draft, vendor]);

  return (
    <Screen>
      <Title>New invoice</Title>
      <Muted>Saved on this device only. No internet required.</Muted>
      <Body style={{ fontWeight: '700' }}>Customer</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip
          label="Walk-in"
          selected={draft.customerId == null}
          onPress={() => dispatch(invoiceDraftActions.setWalkIn())}
        />
        {customers.map((customer) => (
          <Chip
            key={customer.id}
            label={customer.name}
            selected={draft.customerId === customer.id}
            onPress={() =>
              dispatch(
                invoiceDraftActions.setCustomer({
                  customerId: customer.id,
                  snapshot: {
                    name: customer.name,
                    phone: customer.phone,
                    gstin: customer.gstin,
                    stateCode: customer.stateCode,
                  },
                }),
              )
            }
          />
        ))}
      </View>
      <Body style={{ fontWeight: '700' }}>Products</Body>
      {products.map((product) => (
        <Card key={product.id} onPress={() => dispatch(invoiceDraftActions.addProductLine(product))}>
          <Body style={{ fontWeight: '700' }}>{product.name}</Body>
          <Muted>
            {paiseToRupeeLabel(product.sellingPricePaise)} / {product.unit}
          </Muted>
        </Card>
      ))}
      {draft.lines.map((line) => (
        <Card key={line.key}>
          <Body style={{ fontWeight: '700' }}>{line.productName}</Body>
          <TextField
            label={`Quantity (${line.unit})`}
            value={quantityMilliToText(line.quantityMilli)}
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              try {
                dispatch(
                  invoiceDraftActions.setLineQuantity({
                    key: line.key,
                    quantityMilli: quantityTextToMilli(value || '0'),
                  }),
                );
              } catch {
                // ignore invalid in-progress input
              }
            }}
          />
          <Button
            label="Remove"
            variant="secondary"
            onPress={() => dispatch(invoiceDraftActions.removeLine(line.key))}
          />
        </Card>
      ))}
      <TextField
        label="Invoice discount (₹)"
        value={discountText}
        keyboardType="decimal-pad"
        onChangeText={(value) => {
          setDiscountText(value);
          try {
            dispatch(invoiceDraftActions.setDiscountPaise(rupeesTextToPaise(value || '0')));
          } catch {
            dispatch(invoiceDraftActions.setDiscountPaise(0));
          }
        }}
      />
      {totals ? (
        <Card>
          <Muted>Taxable {paiseToRupeeLabel(totals.taxablePaise)}</Muted>
          <Muted>CGST {paiseToRupeeLabel(totals.cgstPaise)}</Muted>
          <Muted>SGST {paiseToRupeeLabel(totals.sgstPaise)}</Muted>
          <Muted>IGST {paiseToRupeeLabel(totals.igstPaise)}</Muted>
          <Body style={{ fontWeight: '700' }}>Total {paiseToRupeeLabel(totals.totalPaise)}</Body>
        </Card>
      ) : null}
      <Button
        label="Preview"
        onPress={() => navigation.navigate('InvoicePreview')}
        disabled={draft.lines.length === 0}
      />
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.sm,
        backgroundColor: selected ? colors.primary : colors.chip,
      }}
    >
      <Text style={{ color: selected ? colors.primaryText : colors.ink, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
