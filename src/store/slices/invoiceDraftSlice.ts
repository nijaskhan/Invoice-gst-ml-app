import type { CustomerSnapshot, PaymentMethod, Product } from '@invoice-gst/types';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createId } from '../../utils/id';

export type DraftLine = {
  key: string;
  productId: string | null;
  productName: string;
  localName: string | null;
  hsnCode: string | null;
  unit: string;
  quantityMilli: number;
  unitPricePaise: number;
  gstRateBps: number;
  priceInclusive: boolean;
  lineDiscountPaise: number;
};

export type InvoiceDraftState = {
  customerId: string | null;
  customerSnapshot: CustomerSnapshot;
  invoiceDiscountPaise: number;
  notes: string;
  paymentMethod: PaymentMethod;
  collectPayment: boolean;
  lines: DraftLine[];
};

const walkInSnapshot: CustomerSnapshot = {
  name: 'Walk-in',
  phone: null,
  gstin: null,
  stateCode: null,
};

const initialState: InvoiceDraftState = {
  customerId: null,
  customerSnapshot: walkInSnapshot,
  invoiceDiscountPaise: 0,
  notes: '',
  paymentMethod: 'cash',
  collectPayment: true,
  lines: [],
};

const invoiceDraftSlice = createSlice({
  name: 'invoiceDraft',
  initialState,
  reducers: {
    resetDraft() {
      return initialState;
    },
    setWalkIn(state) {
      state.customerId = null;
      state.customerSnapshot = walkInSnapshot;
    },
    setCustomer(
      state,
      action: PayloadAction<{ customerId: string; snapshot: CustomerSnapshot }>,
    ) {
      state.customerId = action.payload.customerId;
      state.customerSnapshot = action.payload.snapshot;
    },
    setDiscountPaise(state, action: PayloadAction<number>) {
      state.invoiceDiscountPaise = Math.max(0, action.payload);
    },
    setNotes(state, action: PayloadAction<string>) {
      state.notes = action.payload;
    },
    setPaymentMethod(state, action: PayloadAction<PaymentMethod>) {
      state.paymentMethod = action.payload;
    },
    setCollectPayment(state, action: PayloadAction<boolean>) {
      state.collectPayment = action.payload;
    },
    addBillingLine(
      state,
      action: PayloadAction<{
        productId: string;
        productName: string;
        localName: string | null;
        hsnCode: string | null;
        unit: string;
        quantityMilli: number;
        unitPricePaise: number;
        gstRateBps: number;
        priceInclusive: boolean;
        priced: boolean;
      }>,
    ) {
      const incoming = action.payload;
      const existing = state.lines.find((line) => line.productId === incoming.productId);
      if (existing) {
        existing.quantityMilli += incoming.quantityMilli;
        if (incoming.priced) {
          existing.unitPricePaise = incoming.unitPricePaise;
        }
        return;
      }
      state.lines.push({
        key: createId(),
        productId: incoming.productId,
        productName: incoming.productName,
        localName: incoming.localName,
        hsnCode: incoming.hsnCode,
        unit: incoming.unit,
        quantityMilli: incoming.quantityMilli,
        unitPricePaise: incoming.unitPricePaise,
        gstRateBps: incoming.gstRateBps,
        priceInclusive: incoming.priceInclusive,
        lineDiscountPaise: 0,
      });
    },
    addProductLine(state, action: PayloadAction<Product>) {
      const product = action.payload;
      const existing = state.lines.find((line) => line.productId === product.id);
      if (existing) {
        existing.quantityMilli += 1000;
        return;
      }
      state.lines.push({
        key: createId(),
        productId: product.id,
        productName: product.name,
        localName: product.localName,
        hsnCode: product.hsnCode,
        unit: product.unit,
        quantityMilli: 1000,
        unitPricePaise: product.sellingPricePaise,
        gstRateBps: product.gstRateBps,
        priceInclusive: product.priceInclusive,
        lineDiscountPaise: 0,
      });
    },
    setLineQuantity(state, action: PayloadAction<{ key: string; quantityMilli: number }>) {
      const line = state.lines.find((item) => item.key === action.payload.key);
      if (line) {
        line.quantityMilli = Math.max(1, action.payload.quantityMilli);
      }
    },
    removeLine(state, action: PayloadAction<string>) {
      state.lines = state.lines.filter((line) => line.key !== action.payload);
    },
  },
});

export const invoiceDraftActions = invoiceDraftSlice.actions;
export const invoiceDraftReducer = invoiceDraftSlice.reducer;
