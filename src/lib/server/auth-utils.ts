import { error } from '@sveltejs/kit';
import type { SessionValidationResult } from './auth';

export function requireAuth(locals: { user: SessionValidationResult['user'] }, requiredRole?: 'user' | 'admin') {
    if (!locals.user) {
        throw error(401, 'Authentication required');
    }
    
    if (requiredRole === 'admin' && locals.user.role !== 'admin') {
        throw error(403, 'Admin access required');
    }
    
    return locals.user;
}

export function optionalAuth(locals: { user: SessionValidationResult['user'] }) {
    return locals.user || null;
}