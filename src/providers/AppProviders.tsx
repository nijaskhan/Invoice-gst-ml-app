import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Suspense, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from '../store';
import { colors } from '../theme/theme';
import { DatabaseFallback, DatabaseProvider } from './DatabaseProvider';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    primary: colors.primary,
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <Suspense fallback={<DatabaseFallback />}>
            <DatabaseProvider>
              <NavigationContainer theme={navigationTheme}>
                <StatusBar style="dark" />
                {children}
              </NavigationContainer>
            </DatabaseProvider>
          </Suspense>
        </Provider>
      </SafeAreaProvider>
    </View>
  );
}
