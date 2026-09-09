import { formatInvoiceNumber } from '@invoice-gst/shared';
import type {
  Invoice,
  InvoiceItem,
  InvoiceWithItems,
  PaymentMethod,
} from '@invoice-gst/types';
import { and, desc, eq } from 'drizzle-orm';
import { nowIso } from '../../utils/clock';
import { InvoiceStateError } from '../../utils/errors';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { mapInvoice, mapInvoiceItem, mapPayment } from '../mappers';
import {
  auditEvents,
  invoiceItems,
  invoiceSequences,
  invoices,
  payments,
  syncQueue,
} from '../schema';

export type FinalizeInvoiceInput = {
  invoice: Omit<
    Invoice,
    | 'id'
    | 'invoiceNumber'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'finalizedAt'
    | 'syncStatus'
  >;
  items: Array<Omit<InvoiceItem, 'id' | 'invoiceId'>>;
  payment?: { method: PaymentMethod; amountPaise: number; reference?: string | null };
  vendorId: string;
  prefix: string;
};

export function createInvoiceRepository(db: AppDatabase) {
  return {
    async list(): Promise<Invoice[]> {
      const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
      return rows.map(mapInvoice);
    },

    async getWithItems(id: string): Promise<InvoiceWithItems | null> {
      const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
      const invoiceRow = invoiceRows[0];
      if (!invoiceRow) {
        return null;
      }
      const itemRows = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, id));
      return {
        ...mapInvoice(invoiceRow),
        items: itemRows.map(mapInvoiceItem),
        payments: paymentRows.map(mapPayment),
      };
    },

    async finalize(input: FinalizeInvoiceInput): Promise<InvoiceWithItems> {
      const timestamp = nowIso();
      const invoiceId = createId();

      return db.transaction(async (tx) => {
        const sequenceRows = await tx
          .select()
          .from(invoiceSequences)
          .where(
            and(
              eq(invoiceSequences.vendorId, input.vendorId),
              eq(invoiceSequences.financialYear, input.invoice.financialYear),
            ),
          )
          .limit(1);
        const existing = sequenceRows[0];

        let sequence: number;
        if (!existing) {
          sequence = 1;
          await tx.insert(invoiceSequences).values({
            id: createId(),
            vendorId: input.vendorId,
            financialYear: input.invoice.financialYear,
            nextNumber: 2,
          });
        } else {
          sequence = existing.nextNumber;
          await tx
            .update(invoiceSequences)
            .set({ nextNumber: existing.nextNumber + 1 })
            .where(eq(invoiceSequences.id, existing.id));
        }

        const invoiceNumber = formatInvoiceNumber(
          input.prefix,
          input.invoice.financialYear,
          sequence,
        );

        await tx.insert(invoices).values({
          id: invoiceId,
          invoiceNumber,
          financialYear: input.invoice.financialYear,
          customerId: input.invoice.customerId,
          customerSnapshot: JSON.stringify(input.invoice.customerSnapshot),
          placeOfSupplyStateCode: input.invoice.placeOfSupplyStateCode,
          isInterState: input.invoice.isInterState ? 1 : 0,
          status: 'finalized',
          subtotalPaise: input.invoice.subtotalPaise,
          discountPaise: input.invoice.discountPaise,
          taxablePaise: input.invoice.taxablePaise,
          cgstPaise: input.invoice.cgstPaise,
          sgstPaise: input.invoice.sgstPaise,
          igstPaise: input.invoice.igstPaise,
          roundOffPaise: input.invoice.roundOffPaise,
          totalPaise: input.invoice.totalPaise,
          paymentStatus: input.invoice.paymentStatus,
          notes: input.invoice.notes,
          createdAt: timestamp,
          updatedAt: timestamp,
          finalizedAt: timestamp,
          syncStatus: 'pending',
        });

        for (const item of input.items) {
          await tx.insert(invoiceItems).values({
            ...item,
            id: createId(),
            invoiceId,
            priceInclusive: item.priceInclusive ? 1 : 0,
          });
        }

        if (input.payment && input.payment.amountPaise > 0) {
          await tx.insert(payments).values({
            id: createId(),
            invoiceId,
            method: input.payment.method,
            amountPaise: input.payment.amountPaise,
            paidAt: timestamp,
            reference: input.payment.reference ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          });
        }

        await tx.insert(auditEvents).values({
          id: createId(),
          entityType: 'invoice',
          entityId: invoiceId,
          action: 'finalized',
          payload: JSON.stringify({ invoiceNumber }),
          createdAt: timestamp,
        });

        await tx.insert(syncQueue).values({
          id: createId(),
          entityType: 'invoice',
          entityId: invoiceId,
          operation: 'create',
          payload: JSON.stringify({ invoiceId }),
          idempotencyKey: createId(),
          createdAt: timestamp,
          retryCount: 0,
          lastError: null,
          status: 'pending',
        });

        const createdRows = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
        const created = createdRows[0];
        const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
        const paymentRows = await tx.select().from(payments).where(eq(payments.invoiceId, invoiceId));
        if (!created) {
          throw new Error('Invoice finalize failed');
        }
        return {
          ...mapInvoice(created),
          items: items.map(mapInvoiceItem),
          payments: paymentRows.map(mapPayment),
        };
      });
    },

    async cancel(id: string): Promise<void> {
      const current = await this.getWithItems(id);
      if (!current) {
        throw new InvoiceStateError('Invoice not found');
      }
      if (current.status === 'cancelled') {
        throw new InvoiceStateError('Invoice is already cancelled');
      }
      if (current.status !== 'finalized') {
        throw new InvoiceStateError('Only finalized invoices can be cancelled');
      }

      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set({ status: 'cancelled', updatedAt: timestamp, syncStatus: 'pending' })
          .where(eq(invoices.id, id));
        await tx.insert(auditEvents).values({
          id: createId(),
          entityType: 'invoice',
          entityId: id,
          action: 'cancelled',
          payload: JSON.stringify({ invoiceNumber: current.invoiceNumber }),
          createdAt: timestamp,
        });
        await tx.insert(syncQueue).values({
          id: createId(),
          entityType: 'invoice',
          entityId: id,
          operation: 'update',
          payload: JSON.stringify({ id, status: 'cancelled' }),
          idempotencyKey: createId(),
          createdAt: timestamp,
          retryCount: 0,
          lastError: null,
          status: 'pending',
        });
      });
    },
  };
}
