import {
  extractBillingText,
  matchBillingLine,
  paiseToRupeeLabel,
  quantityMilliToText,
  resolvePlaceOfSupply,
  rupeesTextToPaise,
  type BillingMatch,
} from '@invoice-gst/shared';
import type { Customer, Product } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Divider } from '../../components/common/Divider';
import { Icon } from '../../components/common/Icon';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { Screen } from '../../components/common/Screen';
import { SearchField } from '../../components/common/SearchField';
import { Section } from '../../components/common/Section';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { TextField } from '../../components/common/TextField';
import { stateLabel } from '../../constants/states';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { totalsFromDraft } from '../../services/invoice/draftTotals';
import { useAppDispatch, useAppSelector } from '../../store';
import { invoiceDraftActions, type DraftLine } from '../../store/slices/invoiceDraftSlice';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { formatRupees, paymentMethodLabel } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import { CustomerPickerSheet } from './components/CustomerPickerSheet';
import { QuantityStepper } from './components/QuantityStepper';
import { TotalsSummary } from './components/TotalsSummary';

/** Rendering every product in a long catalogue would slow typing; search narrows it. */
const CATALOGUE_LIMIT = 40;

function matchesProduct(product: Product, needle: string): boolean {
  return (
    product.name.toLowerCase().includes(needle) ||
    Boolean(product.localName?.toLowerCase().includes(needle)) ||
    product.aliases.some((alias) => alias.toLowerCase().includes(needle)) ||
    Boolean(product.sku?.toLowerCase().includes(needle))
  );
}

export function InvoiceCreateScreen() {
  const navigation = useNavigation<StackNavigation>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const draft = useAppSelector((state) => state.invoiceDraft);
  const styles = useThemedStyles(createStyles);
  const [discountText, setDiscountText] = useState(() =>
    draft.invoiceDiscountPaise > 0 ? paiseToRupeeLabel(draft.invoiceDiscountPaise).replace('₹', '') : '',
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [billingText, setBillingText] = useState('');
  const [billingError, setBillingError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([repos.products.listActive(), repos.customers.list(), repos.vendors.get()]),
    [repos],
  );
  const query = useFocusedQuery(load);
  const products = query.data?.[0] ?? [];
  const customers = query.data?.[1] ?? [];
  const vendor = query.data?.[2] ?? null;

  const totals = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return totalsFromDraft(draft, vendor, null);
  }, [draft, vendor]);

  const isInterState = vendor
    ? resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode).isInterState
    : false;

  const quantityByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of draft.lines) {
      if (line.productId) {
        map.set(line.productId, line.quantityMilli);
      }
    }
    return map;
  }, [draft.lines]);

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    return needle ? products.filter((product) => matchesProduct(product, needle)) : products;
  }, [products, productQuery]);
  const visibleProducts = filteredProducts.slice(0, CATALOGUE_LIMIT);

  function addFromText() {
    const extracted = extractBillingText(billingText);
    if (extracted.length === 0) {
      setBillingError('Type a product and a quantity. Example: 2 kg rice 100 rupees');
      return;
    }
    const results = extracted.map((line) => matchBillingLine(line, products));
    let added = 0;
    const problems: string[] = [];
    for (const result of results) {
      if (result.ok) {
        dispatch(invoiceDraftActions.addBillingLine({ ...result.line, priced: result.priced }));
        added += 1;
      } else {
        problems.push(billingMissMessage(result));
      }
    }
    setBillingError(problems.length > 0 ? problems.join(' ') : null);
    if (added > 0) {
      setBillingText('');
      haptics.light();
    }
  }

  function selectCustomer(customer: Customer) {
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
    );
  }

  const itemCount = draft.lines.length;
  const loading = query.status === 'loading';

  return (
    <Screen
      keyboard
      footer={
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text variant="caption" tone="secondary">
              {itemCount === 0 ? 'No items yet' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} · incl. GST`}
            </Text>
            <Amount paise={totals?.totalPaise ?? 0} variant="h2" quietPaise />
          </View>
          <Button
            label="Review"
            icon="arrow-forward"
            iconPosition="trailing"
            onPress={() => navigation.navigate('InvoicePreview')}
            disabled={itemCount === 0}
            accessibilityHint="Check the invoice before saving it"
            style={styles.footerButton}
          />
        </View>
      }
    >
      {query.status === 'error' && !query.data ? (
        <ErrorState
          title="Couldn't load your catalogue"
          message={query.error}
          onRetry={query.reload}
        />
      ) : null}

      <Section title="Bill to">
        <Card
          onPress={() => setPickerOpen(true)}
          accessibilityLabel={`Bill to ${draft.customerSnapshot.name}`}
          accessibilityHint="Choose a different customer"
        >
          <View style={styles.customerRow}>
            {draft.customerId ? (
              <Avatar name={draft.customerSnapshot.name} />
            ) : (
              <Avatar icon="walk-outline" tone="neutral" />
            )}
            <View style={styles.customerText}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {draft.customerId ? draft.customerSnapshot.name : 'Walk-in customer'}
              </Text>
              <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                {draft.customerId
                  ? [
                      draft.customerSnapshot.phone,
                      draft.customerSnapshot.gstin ?? stateLabel(draft.customerSnapshot.stateCode),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Tap to pick a saved customer'}
              </Text>
            </View>
            <Text variant="label" tone="brand">
              Change
            </Text>
          </View>
        </Card>
        {isInterState ? (
          <View style={styles.notice}>
            <Icon name="swap-horizontal" size="small" tone="info" />
            <Text variant="caption" tone="info" style={styles.noticeText}>
              Inter-state sale — IGST applies instead of CGST + SGST.
            </Text>
          </View>
        ) : null}
      </Section>

      <Section
        title="Items"
        description={itemCount > 0 ? undefined : 'Tap products below to add them. Tap again to add one more.'}
      >
        {itemCount > 0 ? (
          <Card padded={false}>
            {draft.lines.map((line, index) => (
              <View key={line.key}>
                {index > 0 ? <Divider inset={space[4]} /> : null}
                <CartLineRow
                  line={line}
                  lineTotalPaise={totals?.lines[index]?.lineTotalPaise}
                  onChange={(quantityMilli) =>
                    dispatch(invoiceDraftActions.setLineQuantity({ key: line.key, quantityMilli }))
                  }
                  onRemove={() => dispatch(invoiceDraftActions.removeLine(line.key))}
                />
              </View>
            ))}
          </Card>
        ) : (
          <View style={styles.emptyCart}>
            <Icon name="basket-outline" tone="textTertiary" />
            <Text variant="bodySmall" tone="secondary">
              Nothing on this bill yet
            </Text>
          </View>
        )}
      </Section>

      <Section
        title="Add in words"
        description="The amount is for the whole quantity. Say “at” or “per” when you mean the rate."
      >
        <TextField
          label="Billing line"
          value={billingText}
          placeholder="2 kg rice 100 rupees"
          hint="Uses the product name or alias saved in your catalogue."
          error={billingError}
          returnKeyType="done"
          onChangeText={(value) => {
            setBillingText(value);
            if (billingError) {
              setBillingError(null);
            }
          }}
          onSubmitEditing={addFromText}
        />
        <Button
          label="Add to bill"
          variant="secondary"
          icon="add"
          disabled={billingText.trim().length === 0}
          onPress={addFromText}
        />
      </Section>

      <Section title="Add from catalogue" gap={space[3]}>
        {products.length > 6 ? (
          <SearchField
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder="Search name, local name or alias"
          />
        ) : null}
        {loading ? <SkeletonList rows={4} /> : null}
        {!loading && products.length === 0 && query.status !== 'error' ? (
          <Card>
            <EmptyState
              compact
              icon="cube-outline"
              title="Your catalogue is empty"
              message="Add the products you sell once, with price and GST rate, and bill them in a tap."
              action={{
                label: 'Add product',
                icon: 'add',
                onPress: () => navigation.navigate('ProductForm', {}),
              }}
            />
          </Card>
        ) : null}
        {visibleProducts.length > 0 ? (
          <View>
            {visibleProducts.map((product, index) => {
              const inCart = quantityByProduct.get(product.id);
              return (
                <ListItem
                  key={product.id}
                  title={product.name}
                  subtitle={`${formatRupees(product.sellingPricePaise)} / ${product.unit} · ${product.gstRateBps / 100}% GST`}
                  leading={<Avatar name={product.name} shape="square" size={36} />}
                  trailing={
                    inCart ? (
                      <Badge label={`${quantityMilliToText(inCart)} in bill`} tone="brand" />
                    ) : (
                      <Icon name="add-circle-outline" tone="primaryText" size="large" />
                    )
                  }
                  chevron={false}
                  position={groupPosition(index, visibleProducts.length)}
                  accessibilityLabel={`Add ${product.name}`}
                  accessibilityHint={inCart ? 'Adds one more to the bill' : 'Adds it to the bill'}
                  onPress={() => {
                    haptics.light();
                    dispatch(invoiceDraftActions.addProductLine(product));
                  }}
                />
              );
            })}
          </View>
        ) : null}
        {!loading && products.length > 0 && filteredProducts.length === 0 ? (
          <Text variant="bodySmall" tone="secondary" align="center" style={styles.hint}>
            No products match “{productQuery}”
          </Text>
        ) : null}
        {filteredProducts.length > CATALOGUE_LIMIT ? (
          <Text variant="caption" tone="tertiary" align="center">
            Showing {CATALOGUE_LIMIT} of {filteredProducts.length}. Search to narrow the list.
          </Text>
        ) : null}
      </Section>

      <Section title="Discount">
        <TextField
          label="Bill discount"
          optional
          prefix="₹"
          value={discountText}
          placeholder="0.00"
          keyboardType="decimal-pad"
          hint="Taken off the taxable value, spread across items."
          onChangeText={(value) => {
            setDiscountText(value);
            try {
              dispatch(invoiceDraftActions.setDiscountPaise(rupeesTextToPaise(value || '0')));
            } catch {
              dispatch(invoiceDraftActions.setDiscountPaise(0));
            }
          }}
        />
      </Section>

      {totals && itemCount > 0 ? (
        <Section title="Summary">
          <Card>
            <TotalsSummary totals={totals} isInterState={isInterState} />
          </Card>
          <Text variant="caption" tone="tertiary">
            Payment defaults to {paymentMethodLabel[draft.paymentMethod].toLowerCase()} — you can change it on the next step.
          </Text>
        </Section>
      ) : null}

      <CustomerPickerSheet
        visible={pickerOpen}
        customers={customers}
        selectedId={draft.customerId}
        onClose={() => setPickerOpen(false)}
        onSelectWalkIn={() => dispatch(invoiceDraftActions.setWalkIn())}
        onSelectCustomer={selectCustomer}
        onCreateCustomer={() => navigation.navigate('CustomerForm', {})}
      />
    </Screen>
  );
}

function billingMissMessage(result: Extract<BillingMatch, { ok: false }>): string {
  if (result.reason === 'ambiguous') {
    return `“${result.productText}” matches more than one product. Pick it from the catalogue.`;
  }
  if (result.reason === 'unit') {
    return `“${result.productText}” is not sold in that unit.`;
  }
  return `No saved product matches “${result.productText}”. Check the name or alias, or pick it from the catalogue.`;
}

function CartLineRow({
  line,
  lineTotalPaise,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  lineTotalPaise: number | undefined;
  onChange: (quantityMilli: number) => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.line}>
      <View style={styles.lineHeader}>
        <Text variant="bodyMedium" numberOfLines={2}>
          {line.productName}
          {line.localName ? (
            <Text variant="bodySmall" tone="secondary">
              {'  '}
              {line.localName}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption" tone="tertiary" tabular>
          {formatRupees(line.unitPricePaise)} / {line.unit} · {line.gstRateBps / 100}% GST
          {line.priceInclusive ? ' incl.' : ''}
        </Text>
      </View>
      <View style={styles.lineBottom}>
        <QuantityStepper
          quantityMilli={line.quantityMilli}
          unit={line.unit}
          productName={line.productName}
          onChange={onChange}
          onRemove={onRemove}
        />
        {lineTotalPaise != null ? <Amount paise={lineTotalPaise} variant="bodyMedium" /> : null}
      </View>
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[4],
    },
    footerTotal: {
      flex: 1,
    },
    footerButton: {
      minWidth: 140,
    },
    customerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    customerText: {
      flex: 1,
      gap: 2,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.medium,
      backgroundColor: colors.infoSoft,
    },
    noticeText: {
      flex: 1,
    },
    emptyCart: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[2],
      paddingVertical: space[6],
      borderRadius: radius.large,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
    },
    hint: {
      paddingVertical: space[4],
    },
    line: {
      padding: space[4],
      gap: space[3],
    },
    lineHeader: {
      gap: 2,
    },
    lineBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
    },
  });
}
