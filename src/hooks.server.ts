import { migrateDatabase } from './lib/server/db/migrate';
import { validateSessionToken, sessionCookieName } from './lib/server/auth';
import { getUserByUsername } from './lib/server/user-service';
import { createAdminUser } from './lib/server/create-admin-user';

// Run database migration on server start
migrateDatabase().catch(console.error);

// Create admin user if it doesn't exist
async function ensureAdminUser() {
    try {
        const adminUser = await getUserByUsername('admin');
        if (!adminUser) {
            console.log('Creating admin user...');
            await createAdminUser();
            console.log('Admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error ensuring admin user exists:', error);
    }
}

// Run admin user creation on server start
ensureAdminUser().catch(console.error);

export async function handle({ event, resolve }) {
    const sessionToken = event.cookies.get(sessionCookieName) || null;
    
    if (sessionToken) {
        const { session, user } = await validateSessionToken(sessionToken);
        if (session) {
            event.locals.user = user;
            event.locals.session = session;
        }
    }
    
    return resolve(event);
}
