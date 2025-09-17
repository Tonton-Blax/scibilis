import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getUserById, updateUser, deleteUser } from '$lib/server/user-service';
import { requireAuth } from '$lib/server/auth-utils';

export async function GET({ params, locals }: RequestEvent) {
    try {
        // Check if user is authenticated
        const currentUser = requireAuth(locals);
        
        // Users can only view their own profile unless they're an admin
        if (currentUser.role !== 'admin' && currentUser.id !== params.id) {
            return error(403, 'You can only view your own profile');
        }
        
        const user = await getUserById(params.id);
        
        if (!user) {
            return error(404, 'User not found');
        }
        
        return json(user);
    } catch (err) {
        if (err instanceof Error) {
            return error(500, err.message);
        }
        return error(500, 'An unknown error occurred');
    }
}

export async function PUT({ params, request, locals }: RequestEvent) {
    try {
        // Check if user is authenticated
        const currentUser = requireAuth(locals);
        
        // Users can only update their own profile unless they're an admin
        if (currentUser.role !== 'admin' && currentUser.id !== params.id) {
            return error(403, 'You can only update your own profile');
        }
        
        const userData = await request.json();
        
        // Only admins can change roles
        if (currentUser.role !== 'admin' && userData.role) {
            return error(403, 'You cannot change your role');
        }
        
        // Regular users cannot change their active status
        if (currentUser.role !== 'admin' && userData.isActive !== undefined) {
            return error(403, 'You cannot change your active status');
        }
        
        const updatedUser = await updateUser(params.id, userData);
        
        if (!updatedUser) {
            return error(404, 'User not found');
        }
        
        return json(updatedUser);
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

export async function DELETE({ params, locals }: RequestEvent) {
    try {
        // Only admins can delete users
        requireAuth(locals, 'admin');
        
        const success = await deleteUser(params.id);
        
        if (!success) {
            return error(404, 'User not found');
        }
        
        return json({ success: true });
    } catch (err) {
        if (err instanceof Error) {
            return error(500, err.message);
        }
        return error(500, 'An unknown error occurred');
    }
}