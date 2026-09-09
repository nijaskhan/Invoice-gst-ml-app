import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createDb, type AppDatabase } from '../database/client';
import migrations from '../database/migrations/migrations';
import { createRepositories, type Repositories } from '../database/repositories';
import { seedIfEmpty } from '../database/seed';
import { colors } from '../theme/theme';
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
  const db = createDb(sqlite);
  await migrate(db, migrations);
  await seedIfEmpty(db);
  logger.info('database_ready');
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ color: colors.danger, fontSize: 16 }}>{error}</Text>
      </View>
    );
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

export function DatabaseFallback() {
  useEffect(() => {
    // reserved for suspense fallback
  }, []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ marginTop: 12, color: colors.muted }}>Opening local ledger…</Text>
    </View>
  );
}
