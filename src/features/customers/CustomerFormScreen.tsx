import { customerFormSchema } from '@invoice-gst/validation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { GST_STATE_CODES } from '../../constants/states';
import { colors, radius, space } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';

export function CustomerFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'CustomerForm'>) {
  const { repos } = useDatabase();
  const customerId = route.params.customerId;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [customerType, setCustomerType] = useState<'b2c' | 'b2b' | 'unregistered'>('b2c');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) {
      return;
    }
    void repos.customers.get(customerId).then((customer) => {
      if (!customer) {
        return;
      }
      setName(customer.name);
      setPhone(customer.phone ?? '');
      setEmail(customer.email ?? '');
      setAddressLine1(customer.addressLine1 ?? '');
      setCity(customer.city ?? '');
      setStateCode(customer.stateCode ?? '');
      setPincode(customer.pincode ?? '');
      setGstin(customer.gstin ?? '');
      setCustomerType(customer.customerType);
    });
  }, [customerId, repos]);

  async function onSave() {
    const parsed = customerFormSchema.safeParse({
      name,
      phone,
      email,
      addressLine1,
      city,
      stateCode,
      pincode,
      gstin,
      customerType,
    });
    if (!parsed.success) {
      Alert.alert('Check customer', parsed.error.issues[0]?.message ?? 'Invalid customer');
      return;
    }
    setSaving(true);
    try {
      const values = {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        addressLine1: parsed.data.addressLine1 || null,
        city: parsed.data.city || null,
        stateCode: parsed.data.stateCode || null,
        pincode: parsed.data.pincode || null,
        gstin: parsed.data.gstin || null,
        customerType: parsed.data.customerType,
      };
      if (customerId) {
        await repos.customers.update(customerId, values);
      } else {
        await repos.customers.create(values);
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
      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextField label="Address" value={addressLine1} onChangeText={setAddressLine1} />
      <TextField label="City" value={city} onChangeText={setCity} />
      <TextField label="PIN" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />
      <TextField label="GSTIN" value={gstin} onChangeText={setGstin} />
      <Body>State</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {GST_STATE_CODES.map((state) => (
          <Pressable
            key={state.code}
            onPress={() => setStateCode(state.code)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: stateCode === state.code ? colors.primary : colors.chip,
            }}
          >
            <Text style={{ color: stateCode === state.code ? colors.primaryText : colors.ink }}>
              {state.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button label={customerId ? 'Update customer' : 'Save customer'} onPress={() => void onSave()} loading={saving} />
    </Screen>
  );
}
