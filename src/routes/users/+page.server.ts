import { requireAuth } from '$lib/server/auth-utils';

export const load = async ({ locals }: { locals: any }) => {
    // Check if user is authenticated and is an admin
    requireAuth(locals, 'admin');
    
    return {};
};