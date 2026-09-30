import type { Customer } from '@invoice-gst/types';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Avatar } from '../../../components/common/Avatar';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { ListItem, groupPosition } from '../../../components/common/ListItem';
import { SearchField } from '../../../components/common/SearchField';
import { Text } from '../../../components/common/AppText';
import { stateLabel } from '../../../constants/states';
import { space } from '../../../theme/theme';
import { haptics } from '../../../utils/haptics';

export function CustomerPickerSheet({
  visible,
  customers,
  selectedId,
  onSelectWalkIn,
  onSelectCustomer,
  onCreateCustomer,
  onClose,
}: {
  visible: boolean;
  customers: readonly Customer[];
  selectedId: string | null;
  onSelectWalkIn: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onCreateCustomer: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return customers;
    }
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(needle) ||
        customer.phone?.includes(needle) ||
        customer.gstin?.toLowerCase().includes(needle),
    );
  }, [customers, query]);

  function close() {
    setQuery('');
    onClose();
  }

  const showWalkIn = query.trim().length === 0;
  const rows = showWalkIn ? filtered.length + 1 : filtered.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Bill to"
      description="Walk-in bills need no details. Pick a saved customer to print their name and GSTIN."
      fullHeight={customers.length > 5}
      footer={
        <Button
          label="New customer"
          icon="person-add-outline"
          variant="secondary"
          onPress={() => {
            close();
            onCreateCustomer();
          }}
        />
      }
    >
      {customers.length > 5 ? (
        <SearchField value={query} onChangeText={setQuery} placeholder="Search name, phone or GSTIN" />
      ) : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {showWalkIn ? (
          <ListItem
            title="Walk-in customer"
            subtitle="No customer details on the invoice"
            leading={<Avatar icon="walk-outline" tone="neutral" />}
            trailing={selectedId == null ? <Icon name="checkmark" tone="primaryText" /> : null}
            chevron={false}
            position={groupPosition(0, rows)}
            onPress={() => {
              haptics.selection();
              onSelectWalkIn();
              close();
            }}
          />
        ) : null}
        {filtered.map((customer, index) => (
          <ListItem
            key={customer.id}
            title={customer.name}
            subtitle={[customer.phone, customer.gstin ?? stateLabel(customer.stateCode)]
              .filter(Boolean)
              .join(' · ')}
            leading={<Avatar name={customer.name} />}
            trailing={
              selectedId === customer.id ? <Icon name="checkmark" tone="primaryText" /> : null
            }
            chevron={false}
            position={groupPosition(showWalkIn ? index + 1 : index, rows)}
            onPress={() => {
              haptics.selection();
              onSelectCustomer(customer);
              close();
            }}
          />
        ))}
        {!showWalkIn && filtered.length === 0 ? (
          <Text variant="bodySmall" tone="secondary" align="center" style={styles.noMatch}>
            No customers match “{query}”
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: space[3],
  },
  listContent: {
    paddingBottom: space[2],
  },
  noMatch: {
    paddingVertical: space[6],
  },
});
