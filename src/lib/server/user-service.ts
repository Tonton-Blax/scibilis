import { eq, and, or, ilike } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hash, verify } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';

function generateUserId() {
    // ID with 120 bits of entropy, or about the same as UUID v4.
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    const id = encodeBase32LowerCase(bytes);
    return id;
}

export type UserWithDetails = typeof table.user.$inferSelect;

export async function getUserById(id: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.id, id));
    return result[0] || null;
}

export async function getUserByUsername(username: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.username, username));
    return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<UserWithDetails | null> {
    const result = await db.select().from(table.user).where(eq(table.user.email, email));
    return result[0] || null;
}

export async function getAllUsers(limit = 50, offset = 0, search?: string): Promise<UserWithDetails[]> {
    if (search) {
        return db
            .select()
            .from(table.user)
            .where(
                or(
                    ilike(table.user.username, `%${search}%`),
                    ilike(table.user.name, `%${search}%`),
                    ilike(table.user.email, `%${search}%`)
                )
            )
            .limit(limit)
            .offset(offset);
    }
    
    return db.select().from(table.user).limit(limit).offset(offset);
}

export async function createUser(userData: {
    username: string;
    email?: string;
    name?: string;
    password: string;
    role?: 'user' | 'admin';
    bio?: string;
}): Promise<UserWithDetails> {
    const userId = generateUserId();
    const passwordHash = await hash(userData.password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });

    const newUser: typeof table.user.$inferInsert = {
        id: userId,
        username: userData.username,
        email: userData.email || null,
        name: userData.name || null,
        passwordHash,
        role: userData.role || 'user',
        bio: userData.bio || null,
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await db.insert(table.user).values(newUser).returning();
    return result[0];
}

export async function updateUser(
    id: string,
    userData: {
        username?: string;
        email?: string;
        name?: string;
        password?: string;
        role?: 'user' | 'admin';
        bio?: string;
        isActive?: boolean;
        emailVerified?: boolean;
    }
): Promise<UserWithDetails | null> {
    const updateData: Partial<typeof table.user.$inferInsert> = { ...userData };
    
    // If password is being updated, hash it
    if (userData.password) {
        updateData.passwordHash = await hash(userData.password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1
        });
        // Remove password from updateData as it's been converted to passwordHash
        delete (updateData as any).password;
    }
    
    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    const result = await db
        .update(table.user)
        .set(updateData)
        .where(eq(table.user.id, id))
        .returning();
    
    return result[0] || null;
}

export async function deleteUser(id: string): Promise<boolean> {
    // First, delete all sessions for this user
    await db.delete(table.session).where(eq(table.session.userId, id));
    
    // Then delete the user
    const result = await db.delete(table.user).where(eq(table.user.id, id));
    return result.changes > 0;
}

export async function validateUserCredentials(
    username: string,
    password: string
): Promise<UserWithDetails | null> {
    const user = await getUserByUsername(username);
    if (!user) return null;

    const validPassword = await verify(user.passwordHash, password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });

    return validPassword ? user : null;
}

export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    if (excludeUserId) {
        const result = await db
            .select({ id: table.user.id })
            .from(table.user)
            .where(and(eq(table.user.username, username), eq(table.user.id, excludeUserId)));
        return result.length === 0;
    }
    
    const result = await db
        .select({ id: table.user.id })
        .from(table.user)
        .where(eq(table.user.username, username));
    return result.length === 0;
}

export async function isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    if (!email) return true;
    
    if (excludeUserId) {
        const result = await db
            .select({ id: table.user.id })
            .from(table.user)
            .where(and(eq(table.user.email, email), eq(table.user.id, excludeUserId)));
        return result.length === 0;
    }
    
    const result = await db
        .select({ id: table.user.id })
        .from(table.user)
        .where(eq(table.user.email, email));
    return result.length === 0;
}