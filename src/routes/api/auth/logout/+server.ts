import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { validateSessionToken, invalidateSession, deleteSessionTokenCookie, sessionCookieName } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const sessionToken = cookies.get(sessionCookieName);
        
        if (sessionToken) {
            // Validate the session token
            const { session } = await validateSessionToken(sessionToken);
            
            if (session) {
                // Invalidate the session
                await invalidateSession(session.id);
            }
            
            // Delete the session cookie
            cookies.delete(sessionCookieName, {
                path: '/'
            });
        }

        return json({
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return json(
            { message: 'An error occurred during logout' },
            { status: 500 }
        );
    }
};