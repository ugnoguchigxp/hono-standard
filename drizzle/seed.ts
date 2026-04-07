import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, threads, comments } from '../api/db/schema';
import { hashPassword } from '../api/lib/password';
import { config } from '../api/config';

async function main() {
  console.log('Seeding database...');
  const client = postgres(config.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // Aggressively clear users to refresh credentials
    console.log('Clearing existing records...');
    await db.delete(comments);
    await db.delete(threads);
    await db.delete(users);
    
    const passwordHash = await hashPassword('8f7D9s2A1q5W4e3R');
    const [user] = await db.insert(users).values({
      email: 'ugnoguchigxp@gmail.com',
      name: 'Admin User',
      passwordHash,
    }).returning();

    console.log('Created admin user:', user.email);

    const [thread] = await db.insert(threads).values({
      title: 'Welcome to Wellpathy.jp',
      content: 'This is a sample thread to get you started.',
      authorId: user.id
    }).returning();

    console.log('Created sample thread');

    await db.insert(comments).values({
      threadId: thread.id,
      content: 'And this is a sample comment!',
      authorId: user.id
    });

    console.log('Created sample comment');
  } catch (err) {
    console.error('Error seeding DB:', err);
  } finally {
    await client.end();
  }
}

main();
