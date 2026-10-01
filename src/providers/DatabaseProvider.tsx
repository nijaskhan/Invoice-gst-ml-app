import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../components/common/AppText';
import { Icon } from '../components/common/Icon';
import { ErrorState } from '../components/common/States';
import { applyMigrations } from '../database/applyMigrations';
import { createDb, type AppDatabase } from '../database/client';
import migrations from '../database/migrations/migrations';
import { createRepositories, type Repositories } from '../database/repositories';
import { seedIfEmpty } from '../database/seed';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/theme';
import { errorMessage } from '../utils/errors';
import { logger } from '../utils/logger';

type DatabaseContextValue = {
  db: AppDatabase;
  repos: Repositories;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function useDatabase(): DatabaseContextValue {
  const value = useContext(DatabaseContext);
  if (!value) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return value;
}

function DatabaseReady({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => createDb(sqlite), [sqlite]);
  const repos = useMemo(() => createRepositories(db), [db]);
  return (
    <DatabaseContext.Provider value={{ db, repos }}>{children}</DatabaseContext.Provider>
  );
}

async function initializeDatabase(sqlite: Parameters<typeof createDb>[0]): Promise<void> {
  await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  await applyMigrations(sqlite, migrations);
  const db = createDb(sqlite);
  await seedIfEmpty(db);
  logger.info('database_ready');
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return <DatabaseError message={error} />;
  }

  return (
    <SQLiteProvider
      databaseName="invoice-gst.db"
      options={{ enableChangeListener: true }}
      onInit={async (sqlite) => {
        try {
          await initializeDatabase(sqlite);
        } catch (initError) {
          logger.error('database_init_failed', { message: errorMessage(initError) });
          setError(errorMessage(initError));
          throw initError;
        }
      }}
    >
      <DatabaseReady>{children}</DatabaseReady>
    </SQLiteProvider>
  );
}

function DatabaseError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.centre, { backgroundColor: colors.background }]}>
      <ErrorState
        title="Couldn't open your ledger"
        message={`Close and reopen the app to try again.\n\nDetails: ${message}`}
      />
    </View>
  );
}

/** Branded launch state while the local database opens and migrates. */
export function DatabaseFallback() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.centre, { backgroundColor: colors.background }]}
      accessibilityLabel="Opening your ledger"
    >
      <View style={[styles.mark, { backgroundColor: colors.hero }]}>
        <Icon name="receipt-outline" size={30} color={colors.onHero} />
      </View>
      <Text variant="h3">GST Invoice</Text>
      <View style={styles.status}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <Text variant="bodySmall" tone="secondary">
          Opening your ledger…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
    padding: space[6],
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.large + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
