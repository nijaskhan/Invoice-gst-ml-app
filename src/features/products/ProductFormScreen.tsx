import { rupeesTextToPaise, paiseToRupeeLabel } from '@invoice-gst/shared';
import { parseAliases, productFormSchema } from '@invoice-gst/validation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { colors, radius, space } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';

const GST_RATES = ['0', '5', '12', '18', '28'] as const;
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'packet', 'other'] as const;

export function ProductFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ProductForm'>) {
  const { repos } = useDatabase();
  const productId = route.params.productId;
  const [name, setName] = useState('');
  const [localName, setLocalName] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [price, setPrice] = useState('50');
  const [gstRatePercent, setGstRatePercent] = useState<(typeof GST_RATES)[number]>('5');
  const [priceInclusive, setPriceInclusive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productId) {
      return;
    }
    void repos.products.get(productId).then((product) => {
      if (!product) {
        return;
      }
      setName(product.name);
      setLocalName(product.localName ?? '');
      setAliasesText(product.aliases.join(', '));
      setSku(product.sku ?? '');
      setHsnCode(product.hsnCode ?? '');
      setUnit(product.unit);
      setPrice(paiseToRupeeLabel(product.sellingPricePaise).replace('₹', ''));
      setGstRatePercent(String(product.gstRateBps / 100) as (typeof GST_RATES)[number]);
      setPriceInclusive(product.priceInclusive);
    });
  }, [productId, repos]);

  async function onSave() {
    const parsed = productFormSchema.safeParse({
      name,
      localName,
      aliasesText,
      sku,
      hsnCode,
      unit,
      sellingPriceRupees: price,
      gstRatePercent,
      priceInclusive,
      isActive: true,
    });
    if (!parsed.success) {
      Alert.alert('Check product', parsed.error.issues[0]?.message ?? 'Invalid product');
      return;
    }

    setSaving(true);
    try {
      const values = {
        name: parsed.data.name,
        localName: parsed.data.localName || null,
        aliases: parseAliases(parsed.data.aliasesText),
        sku: parsed.data.sku || null,
        hsnCode: parsed.data.hsnCode || null,
        unit: parsed.data.unit,
        sellingPricePaise: rupeesTextToPaise(parsed.data.sellingPriceRupees),
        gstRateBps: Number(parsed.data.gstRatePercent) * 100,
        priceInclusive: parsed.data.priceInclusive,
        isActive: true,
      };
      if (productId) {
        await repos.products.update(productId, values);
      } else {
        await repos.products.create(values);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Rice" />
      <TextField label="Local name" value={localName} onChangeText={setLocalName} placeholder="Ari" />
      <TextField
        label="Aliases (comma separated)"
        value={aliasesText}
        onChangeText={setAliasesText}
        placeholder="rice, ari"
      />
      <TextField label="SKU" value={sku} onChangeText={setSku} />
      <TextField label="HSN" value={hsnCode} onChangeText={setHsnCode} />
      <TextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Body>Unit</Body>
      <ChipRow values={UNITS} selected={unit} onSelect={setUnit} />
      <Body>GST %</Body>
      <ChipRow values={GST_RATES} selected={gstRatePercent} onSelect={setGstRatePercent} />
      <ChipRow
        values={['exclusive', 'inclusive']}
        selected={priceInclusive ? 'inclusive' : 'exclusive'}
        onSelect={(value) => setPriceInclusive(value === 'inclusive')}
      />
      <Button label={productId ? 'Update product' : 'Save product'} onPress={() => void onSave()} loading={saving} />
    </Screen>
  );
}

function ChipRow<T extends string>({
  values,
  selected,
  onSelect,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.sm,
            backgroundColor: selected === value ? colors.primary : colors.chip,
          }}
        >
          <Text style={{ color: selected === value ? colors.primaryText : colors.ink, fontWeight: '600' }}>
            {value}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
