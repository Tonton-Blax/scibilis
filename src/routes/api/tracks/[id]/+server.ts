import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth-utils';
import { deleteTrack } from '$lib/server/user-service';

export async function DELETE({ params, locals }: RequestEvent) {
	try {
		const auth = requireAuth(locals);
		const trackId = params.id;
		const ok = await deleteTrack(trackId, auth.user.id);
		if (!ok) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Not found or not allowed' }, { status: 404 });
		}
		return json({ success: true, trackId, timestamp: new Date().toISOString() });
	} catch (err) {
		return json({ success: false, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
}
