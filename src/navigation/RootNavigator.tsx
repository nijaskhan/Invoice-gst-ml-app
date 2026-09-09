import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomerFormScreen } from '../features/customers/CustomerFormScreen';
import { CustomerListScreen } from '../features/customers/CustomerListScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { InvoiceCreateScreen } from '../features/invoices/InvoiceCreateScreen';
import { InvoiceDetailScreen } from '../features/invoices/InvoiceDetailScreen';
import { InvoiceListScreen } from '../features/invoices/InvoiceListScreen';
import { InvoicePreviewScreen } from '../features/invoices/InvoicePreviewScreen';
import { ProductFormScreen } from '../features/products/ProductFormScreen';
import { ProductListScreen } from '../features/products/ProductListScreen';
import { VendorSettingsScreen } from '../features/vendors/VendorSettingsScreen';
import { colors } from '../theme/theme';
import type { RootStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Invoices" component={InvoiceListScreen} />
      <Tab.Screen name="Products" component={ProductListScreen} />
      <Tab.Screen name="Customers" component={CustomerListScreen} />
      <Tab.Screen name="Settings" component={VendorSettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ title: 'Product' }} />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={{ title: 'Customer' }}
      />
      <Stack.Screen
        name="InvoiceCreate"
        component={InvoiceCreateScreen}
        options={{ title: 'New invoice' }}
      />
      <Stack.Screen
        name="InvoicePreview"
        component={InvoicePreviewScreen}
        options={{ title: 'Preview' }}
      />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={{ title: 'Invoice' }}
      />
    </Stack.Navigator>
  );
}
