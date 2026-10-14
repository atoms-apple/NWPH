import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { migrate } from './db/migrate.ts';
import { seedBaseline } from './db/seed.ts';
import { createServer } from './app.ts';
import { countUsers } from './auth/users.ts';
import { purgeExpiredSessions } from './auth/sessions.ts';
import { setSetupToken } from './web/pages/auth.ts';
import { randomToken } from './lib/ids.ts';

const config = loadConfig();

try {
  openDatabase(config.databasePath);
  migrate((m) => console.log(m));
  const seeded = seedBaseline();
  if (seeded.created) console.log('Created organization NWPH with Polar Express as the first venture (provisional).');
} catch (err) {
  console.error(`Could not open or initialise the database at ${config.databasePath}:\n  ${(err as Error).message}`);
  process.exit(1);
}

if (config.production && !config.cookieSecure) {
  console.warn('WARNING: NODE_ENV=production without COOKIE_SECURE. Serve over HTTPS and set COOKIE_SECURE=true.');
}

if (countUsers() === 0) {
  if (config.setupWithoutToken) {
    console.log('\nNo user accounts exist yet. Open NWPH OS (port 4400) in your browser to create your owner account.');
    console.log('Inside a GitHub Codespace no setup token is needed: the forwarded port is private to you.\n');
  } else {
    const token = config.setupToken ?? randomToken(18);
    setSetupToken(token);
    console.log('\nNo user accounts exist yet. Create the first owner account at:');
    console.log(`  http://${config.host}:${config.port}/setup`);
    console.log(`  Setup token: ${token}${config.setupToken ? ' (from SETUP_TOKEN)' : ''}`);
    console.log('Or run: npm run user:create\n');
  }
}

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 3_600_000).unref();

const server = createServer(config);
server.listen(config.port, config.host, () => {
  console.log(`NWPH OS listening on http://${config.host}:${config.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
