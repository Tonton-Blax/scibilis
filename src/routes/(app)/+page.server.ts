import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
    // The authentication check is already handled in the layout server file
    // We can add any additional page-specific logic here if needed
    
    return {
        user: locals.user
    };
}) satisfies PageServerLoad;