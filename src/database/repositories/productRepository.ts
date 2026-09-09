import type { Product } from '@invoice-gst/types';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '../client';
import { mapProduct } from '../mappers';
import { products } from '../schema';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';

function toRow(product: Pick<Product, 'aliases' | 'priceInclusive' | 'isActive'>) {
  return {
    aliases: JSON.stringify(product.aliases),
    priceInclusive: product.priceInclusive ? 1 : 0,
    isActive: product.isActive ? 1 : 0,
  };
}

export function createProductRepository(db: AppDatabase) {
  return {
    async listActive(): Promise<Product[]> {
      const rows = await db
        .select()
        .from(products)
        .where(and(isNull(products.deletedAt), eq(products.isActive, 1)))
        .orderBy(products.name);
      return rows.map(mapProduct);
    },

    async list(): Promise<Product[]> {
      const rows = await db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(products.name);
      return rows.map(mapProduct);
    },

    async get(id: string): Promise<Product | null> {
      const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
      const row = rows[0];
      return row && row.deletedAt == null ? mapProduct(row) : null;
    },

    async create(
      input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Product> {
      const timestamp = nowIso();
      const id = createId();
      await db.insert(products).values({
        ...input,
        ...toRow(input),
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        syncStatus: 'pending',
      });
      const created = await this.get(id);
      if (!created) {
        throw new Error('Product create failed');
      }
      return created;
    },

    async update(
      id: string,
      input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Product> {
      await db
        .update(products)
        .set({
          ...input,
          ...toRow(input),
          updatedAt: nowIso(),
          syncStatus: 'pending',
        })
        .where(and(eq(products.id, id), isNull(products.deletedAt)));
      const updated = await this.get(id);
      if (!updated) {
        throw new Error('Product update failed');
      }
      return updated;
    },

    async softDelete(id: string): Promise<void> {
      await db
        .update(products)
        .set({ deletedAt: nowIso(), updatedAt: nowIso(), syncStatus: 'pending', isActive: 0 })
        .where(eq(products.id, id));
    },
  };
}
