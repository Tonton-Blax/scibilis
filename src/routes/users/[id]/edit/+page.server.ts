import { requireAuth } from '$lib/server/auth-utils';

export const load = async ({ params, locals }: { params: any; locals: any }) => {
    // Check if user is authenticated and is an admin
    requireAuth(locals, 'admin');
    
    return {
        userId: params.id,
        isEdit: true
    };
};