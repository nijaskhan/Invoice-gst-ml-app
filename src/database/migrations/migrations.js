import journal from './meta/_journal.json';
// Inlined at bundle time. Drizzle runs each segment split on `--> statement-breakpoint`.
import m0000 from './0000_init.sql';

export default {
  journal,
  migrations: {
    m0000,
  },
};
