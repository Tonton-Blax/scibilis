import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth-utils';
import { createTrack, getTracksByUser } from '$lib/server/user-service';
import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';

const STORAGE_DIR = env.STORAGE_DIR || path.join(process.cwd(), 'storage');

export async function GET({ locals, url }: RequestEvent) {
	try {
		const auth = requireAuth(locals);
		if (!auth || !auth.id) {
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Authentication required' }, { status: 401 });
		}
		const limit = Number(url.searchParams.get('limit')) || 50;
		const offset = Number(url.searchParams.get('offset')) || 0;
		const tracks = await getTracksByUser(auth.id, limit, offset);
		return json(tracks);
	} catch (err) {
		return json({ success: false, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Unauthorized' }, { status: 401 });
	}
}

export async function POST({ request, locals }: RequestEvent) {
	try {
		console.log('[api/tracks] POST received');

		const auth = requireAuth(locals);
		if (!auth || !auth.id) {
			console.warn('[api/tracks] unauthorized POST attempt - requireAuth returned no user');
			return json({ success: false, timestamp: new Date().toISOString(), error: 'Authentication required' }, { status: 401 });
		}
		const form = await request.formData();
		const file = form.get('file') as unknown as File | null;
		const title = (form.get('title') as string) || '';
		if (!file) {
			console.warn('[api/tracks] POST missing file');
			return json({ success: false, timestamp: new Date().toISOString(), error: 'File missing' }, { status: 400 });
		}

		console.log(`[api/tracks] processing file for user=${auth.id} name=${(file as any).name}`);

		// Check if it's a video file
		const isVideo = (file as any).type?.startsWith('video/') ?? false;
		
		// The client-side code already extracts audio from video files
		// So we just use the file as received
		let audioFile: File | Blob = file;
		let finalFileName = (file as any).name;
		
		// If it's a video file, change the extension to mp3 since the client
		// should have already extracted the audio
		if (isVideo) {
			finalFileName = (file as any).name.replace(/\.[^/.]+$/, '') + '.mp3';
		}

		// write file to storage
		await fs.mkdir(STORAGE_DIR, { recursive: true });
		const ownerDir = `user-${auth.id}`;
		const trackFolder = path.join('tracks', ownerDir);
		const absFolder = path.join(STORAGE_DIR, trackFolder);
		await fs.mkdir(absFolder, { recursive: true });
		const serverFileName = `${crypto.randomUUID()}-${Date.now()}-${finalFileName}`;
		const relPath = path.join(trackFolder, serverFileName);
		const absPath = path.join(STORAGE_DIR, relPath);
		
		// Convert blob to array buffer for writing to disk
		const arrayBuffer = audioFile instanceof File
			? await (audioFile as any).arrayBuffer()
			: await audioFile.arrayBuffer();
		await fs.writeFile(absPath, new Uint8Array(arrayBuffer));

		console.log(`[api/tracks] audio file written to disk: ${absPath}`);

		const created = await createTrack(auth.id, finalFileName, relPath, title || undefined, isVideo);
		console.log(`[api/tracks] track created in DB: id=${created.id} user=${auth.id} path=${relPath}`);
		return json({ success: true, track: created, timestamp: new Date().toISOString() }, { status: 201 });
	} catch (err) {
		console.error('[api/tracks] POST error:', err);
		return json({ success: false, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
}
