/**
 * Command-line administration.
 *   migrate       apply pending migrations and create baseline records
 *   reset         DELETE the database and uploads, then re-initialise (asks for confirmation)
 *   examples      add clearly-marked example records ("examples remove" deletes them)
 *   create-user   create a user interactively
 */
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadConfig } from './config.ts';
import { openDatabase, closeDatabase } from './db/database.ts';
import { migrate } from './db/migrate.ts';
import { seedBaseline } from './db/seed.ts';
import { createUser } from './auth/users.ts';
import { addExamples, removeExamples } from './domain/examples.ts';
import type { Role } from './auth/permissions.ts';

const config = loadConfig();
const [command, arg] = process.argv.slice(2);
const actor = { id: null, name: 'Command line' };

function init(): void {
  openDatabase(config.databasePath);
  migrate((m) => console.log(m));
  if (seedBaseline().created) console.log('Created NWPH organization and Polar Express (provisional).');
}

// Reads answers line by line, so piped input works as well as a terminal.
const iterators = new WeakMap<readline.Interface, AsyncIterator<string>>();
async function ask(rl: readline.Interface, q: string): Promise<string> {
  let it = iterators.get(rl);
  if (!it) {
    it = rl[Symbol.asyncIterator]();
    iterators.set(rl, it);
  }
  stdout.write(q);
  const next = await it.next();
  return next.done ? '' : String(next.value).trim();
}

switch (command) {
  case 'migrate':
    init();
    console.log(`Database ready at ${config.databasePath}`);
    break;
  case 'reset': {
    if (config.production) {
      console.error('Refusing to reset while NODE_ENV=production.');
      process.exit(1);
    }
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const answer = await ask(rl, `This permanently deletes ${config.databasePath} and ${config.uploadDir}.\nType "reset" to continue: `);
    rl.close();
    if (answer !== 'reset') {
      console.log('Cancelled.');
      break;
    }
    for (const f of [config.databasePath, `${config.databasePath}-wal`, `${config.databasePath}-shm`]) fs.rmSync(f, { force: true });
    fs.rmSync(config.uploadDir, { recursive: true, force: true });
    init();
    console.log('Database reset. Create a user with: npm run user:create');
    break;
  }
  case 'examples':
    init();
    if (arg === 'remove') console.log(`Removed ${removeExamples(actor)} example records.`);
    else {
      addExamples(actor);
      console.log('Example records added. Every one is marked [Example]; remove them from Settings or with: npm run db:examples -- remove');
    }
    break;
  case 'create-user': {
    init();
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      const email = await ask(rl, 'Email: ');
      const displayName = await ask(rl, 'Display name: ');
      const role = ((await ask(rl, 'Role (owner/editor/viewer) [owner]: ')) || 'owner') as Role;
      if (!['owner', 'editor', 'viewer'].includes(role)) throw new Error('Role must be owner, editor or viewer.');
      const password = await ask(rl, 'Password (min 12 characters; input is shown): ');
      const user = await createUser({ email, displayName, password, role });
      console.log(`Created ${user.role} ${user.email}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exitCode = 1;
    } finally {
      rl.close();
    }
    break;
  }
  default:
    console.log('Usage: node src/cli.ts <migrate|reset|examples [remove]|create-user>');
    process.exitCode = 1;
}
closeDatabase();
