import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { validateUserCredentials } from '$lib/server/user-service';
import { generateSessionToken, createSession, setSessionTokenCookie, sessionCookieName } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return json(
                { message: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Authenticate the user
        const user = await validateUserCredentials(username, password);

        if (!user) {
            return json(
                { message: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // Generate a session token
        const sessionToken = generateSessionToken();
        
        // Create a session
        const session = await createSession(sessionToken, user.id);
        
        // Set the session cookie
        cookies.set(sessionCookieName, sessionToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            expires: session.expiresAt
        });

        return json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return json(
            { message: 'An error occurred during login' },
            { status: 500 }
        );
    }
};