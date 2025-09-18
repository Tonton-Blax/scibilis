import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth-utils';
import { deleteTrack, getTracksByUser } from '$lib/server/user-service';
import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';

const STORAGE_DIR = env.STORAGE_DIR || path.join(process.cwd(), 'storage');

export async function GET({ params, locals }: RequestEvent) {
	try {
		const auth = requireAuth(locals);
		if (!auth || !auth.id) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Authentication required' }, { status: 401 });
		}
		
		const trackId = params.id;
		const tracks = await getTracksByUser(auth.id, 1000, 0); // Get all tracks to find the one we need
		const track = tracks.find(t => t.id === trackId);
		
		if (!track) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Track not found' }, { status: 404 });
		}
		
		const filePath = path.join(STORAGE_DIR, track.filePath);
		
		// Check if file exists before trying to read it
		try {
			console.log('[API] Attempting to access file:', filePath);
			console.log('[API] Storage dir:', STORAGE_DIR);
			console.log('[API] File path from DB:', track.filePath);
			await fs.access(filePath);
		} catch (error) {
			console.error('[API] File access error:', error);
			console.error('[API] Attempted path:', filePath);
			console.error('[API] Storage dir:', STORAGE_DIR);
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Audio file not found' }, { status: 404 });
		}
		
		const file = await fs.readFile(filePath);
		
		return new Response(new Uint8Array(file), {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Content-Length': file.length.toString(),
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		console.error('[API] GET /api/tracks/[id] error:', err);
		return json({ success: false, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
}

export async function DELETE({ params, locals }: RequestEvent) {
	try {
		const auth = requireAuth(locals);
		if (!auth || !auth.id) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Authentication required' }, { status: 401 });
		}
		
		const trackId = params.id;
		if (!trackId) return;
		const ok = await deleteTrack(trackId, auth.id!);
		if (!ok) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Not found or not allowed' }, { status: 404 });
		}
		return json({ success: true, trackId, timestamp: new Date().toISOString() });
	} catch (err) {
		return json({ success: false, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
}
