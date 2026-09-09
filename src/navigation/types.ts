export type RootTabParamList = {
  Home: undefined;
  Invoices: undefined;
  Products: undefined;
  Customers: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  ProductForm: { productId?: string };
  CustomerForm: { customerId?: string };
  InvoiceCreate: undefined;
  InvoicePreview: undefined;
  InvoiceDetail: { invoiceId: string };
};
