import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../api/db/schema';
import { hashPassword } from '../api/lib/password';
import { config } from '../api/config';

async function main() {
  console.log('Seeding database...');
  const client = postgres(config.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    console.log('Clearing existing records...');
    await db.delete(users);
    
    const passwordHash = await hashPassword('8f7D9s2A1q5W4e3R');
    
    await db.insert(users).values([
      {
        email: 'ugnoguchi@gmail.com',
        name: 'Admin User',
        passwordHash,
      },
      {
        email: 'ugnoguchigxp@gmail.com',
        name: 'Admin User GXP',
        passwordHash,
      }
    ]);

    console.log('Created admin users: ugnoguchi@gmail.com, ugnoguchigxp@gmail.com');
  } catch (err) {
    console.error('Error seeding DB:', err);
  } finally {
    await client.end();
  }
}

main();
