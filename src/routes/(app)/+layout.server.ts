import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        throw redirect(302, '/login');
    }
    
    return {
        user: locals.user
    };
}) satisfies LayoutServerLoad;