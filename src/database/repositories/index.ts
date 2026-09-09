import type { AppDatabase } from '../client';
import { createCustomerRepository } from './customerRepository';
import { createInvoiceRepository } from './invoiceRepository';
import { createProductRepository } from './productRepository';
import { createVendorRepository } from './vendorRepository';

export function createRepositories(db: AppDatabase) {
  return {
    vendors: createVendorRepository(db),
    customers: createCustomerRepository(db),
    products: createProductRepository(db),
    invoices: createInvoiceRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
