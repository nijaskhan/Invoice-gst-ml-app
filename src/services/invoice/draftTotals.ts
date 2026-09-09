import {
  calculateInvoiceTotals,
  paymentStatusFromAmounts,
  resolvePlaceOfSupply,
  type InvoiceTotals,
} from '@invoice-gst/shared';
import type { GstConfiguration, Vendor } from '@invoice-gst/types';
import type { InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';

export function totalsFromDraft(
  draft: InvoiceDraftState,
  vendor: Vendor,
  config: GstConfiguration | null,
): InvoiceTotals {
  const { isInterState } = resolvePlaceOfSupply(
    vendor.stateCode,
    draft.customerSnapshot.stateCode,
  );

  return calculateInvoiceTotals({
    lines: draft.lines.map((line) => ({
      quantityMilli: line.quantityMilli,
      unitPricePaise: line.unitPricePaise,
      gstRateBps: line.gstRateBps,
      priceInclusive: line.priceInclusive,
      lineDiscountPaise: line.lineDiscountPaise,
    })),
    invoiceDiscountPaise: draft.invoiceDiscountPaise,
    isInterState,
    roundingMode: config?.roundingMode ?? 'nearest',
    compositionScheme:
      config?.compositionScheme ?? vendor.gstRegistrationType === 'composition',
  });
}

export function paymentStatusForDraft(
  draft: InvoiceDraftState,
  totalPaise: number,
) {
  const paid = draft.collectPayment ? totalPaise : 0;
  return paymentStatusFromAmounts(totalPaise, paid);
}
