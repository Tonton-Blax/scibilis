import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAllUsers, createUser } from '$lib/server/user-service';
import { requireAuth } from '$lib/server/auth-utils';

export async function GET({ url, locals }: RequestEvent) {
    try {
        // Check if user is authenticated and is an admin
        requireAuth(locals, 'admin');
        
        const limit = Number(url.searchParams.get('limit')) || 50;
        const offset = Number(url.searchParams.get('offset')) || 0;
        const search = url.searchParams.get('search') || undefined;
        
        const users = await getAllUsers(limit, offset, search);
        
        return json(users);
    } catch (err) {
        if (err instanceof Error) {
            return error(500, err.message);
        }
        return error(500, 'An unknown error occurred');
    }
}

export async function POST({ request, locals }: RequestEvent) {
    try {
        // Check if user is authenticated and is an admin
        requireAuth(locals, 'admin');
        
        const userData = await request.json();
        
        // Validate required fields
        if (!userData.username || !userData.password) {
            return error(400, 'Username and password are required');
        }
        
        // Create the user
        const newUser = await createUser(userData);
        
        return json(newUser, { status: 201 });
    } catch (err) {
        if (err instanceof Error) {
            // Check for unique constraint violations
            if (err.message.includes('UNIQUE constraint failed')) {
                return error(409, 'Username or email already exists');
            }
            return error(500, err.message);
        }
        return error(500, 'An unknown error occurred');
    }
}