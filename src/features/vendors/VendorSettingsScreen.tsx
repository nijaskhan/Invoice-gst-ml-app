import { vendorFormSchema } from '@invoice-gst/validation';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useDatabase } from '../../providers/DatabaseProvider';
import { Body, Title } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { GST_STATE_CODES } from '../../constants/states';
import { colors, radius, space } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';

export function VendorSettingsScreen() {
  const { repos } = useDatabase();
  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('32');
  const [pincode, setPincode] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [gstRegistrationType, setGstRegistrationType] = useState<
    'regular' | 'composition' | 'unregistered'
  >('regular');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void repos.vendors.get().then((vendor) => {
      if (!vendor) {
        return;
      }
      setBusinessName(vendor.businessName);
      setTradeName(vendor.tradeName ?? '');
      setGstin(vendor.gstin ?? '');
      setPhone(vendor.phone ?? '');
      setEmail(vendor.email ?? '');
      setAddressLine1(vendor.addressLine1 ?? '');
      setCity(vendor.city ?? '');
      setStateCode(vendor.stateCode);
      setPincode(vendor.pincode ?? '');
      setInvoicePrefix(vendor.invoicePrefix);
      setGstRegistrationType(vendor.gstRegistrationType);
    });
  }, [repos]);

  async function onSave() {
    const parsed = vendorFormSchema.safeParse({
      businessName,
      tradeName,
      gstin,
      phone,
      email,
      addressLine1,
      addressLine2: '',
      city,
      stateCode,
      pincode,
      gstRegistrationType,
      invoicePrefix,
    });
    if (!parsed.success) {
      Alert.alert('Check shop profile', parsed.error.issues[0]?.message ?? 'Invalid profile');
      return;
    }
    setSaving(true);
    try {
      await repos.vendors.upsert({
        businessName: parsed.data.businessName,
        tradeName: parsed.data.tradeName || null,
        gstin: parsed.data.gstin || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        addressLine1: parsed.data.addressLine1 || null,
        addressLine2: null,
        city: parsed.data.city || null,
        stateCode: parsed.data.stateCode,
        pincode: parsed.data.pincode || null,
        gstRegistrationType: parsed.data.gstRegistrationType,
        invoicePrefix: parsed.data.invoicePrefix.toUpperCase(),
      });
      Alert.alert('Saved', 'Shop profile updated on this device.');
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Title>Shop profile</Title>
      <TextField label="Business name" value={businessName} onChangeText={setBusinessName} />
      <TextField label="Trade name" value={tradeName} onChangeText={setTradeName} />
      <TextField label="GSTIN" value={gstin} onChangeText={setGstin} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextField label="Address" value={addressLine1} onChangeText={setAddressLine1} />
      <TextField label="City" value={city} onChangeText={setCity} />
      <TextField label="PIN" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />
      <TextField label="Invoice prefix" value={invoicePrefix} onChangeText={setInvoicePrefix} />
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
      <Body>GST registration</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(['regular', 'composition', 'unregistered'] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setGstRegistrationType(type)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: gstRegistrationType === type ? colors.primary : colors.chip,
            }}
          >
            <Text style={{ color: gstRegistrationType === type ? colors.primaryText : colors.ink }}>
              {type}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button label="Save profile" onPress={() => void onSave()} loading={saving} />
    </Screen>
  );
}
