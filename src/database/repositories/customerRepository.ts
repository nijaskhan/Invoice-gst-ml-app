import type { Customer } from '@invoice-gst/types';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../client';
import { mapCustomer } from '../mappers';
import { customers } from '../schema';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';

export function createCustomerRepository(db: AppDatabase) {
  return {
    async list(): Promise<Customer[]> {
      const rows = await db
        .select()
        .from(customers)
        .where(isNull(customers.deletedAt))
        .orderBy(customers.name);
      return rows.map(mapCustomer);
    },

    async get(id: string): Promise<Customer | null> {
      const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      const row = rows[0];
      return row && row.deletedAt == null ? mapCustomer(row) : null;
    },

    async create(
      input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Customer> {
      const timestamp = nowIso();
      const id = createId();
      await db.insert(customers).values({
        ...input,
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        syncStatus: 'pending',
      });
      const created = await this.get(id);
      if (!created) {
        throw new Error('Customer create failed');
      }
      return created;
    },

    async update(
      id: string,
      input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Customer> {
      await db
        .update(customers)
        .set({ ...input, updatedAt: nowIso(), syncStatus: 'pending' })
        .where(and(eq(customers.id, id), isNull(customers.deletedAt)));
      const updated = await this.get(id);
      if (!updated) {
        throw new Error('Customer update failed');
      }
      return updated;
    },

    async softDelete(id: string): Promise<void> {
      await db
        .update(customers)
        .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending' })
        .where(eq(customers.id, id));
    },
  };
}
