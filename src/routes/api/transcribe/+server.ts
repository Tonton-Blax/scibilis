import { Mistral } from "@mistralai/mistralai";
import * as v from 'valibot';
import { json } from '@sveltejs/kit';
import { MISTRAL_API_KEY } from "$env/static/private";
import { optionalAuth } from '$lib/server/auth-utils';
import { createTrack, createTranscription } from '$lib/server/user-service';
import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';

const STORAGE_DIR = env.STORAGE_DIR || path.join(process.cwd(), 'storage');

// Define the schema for validating the input
const transcribeSchema = v.object({
  audioData: v.object({
    name: v.string(),
    type: v.string(),
    arrayBuffer: v.array(v.number())
  }),
  trackId: v.string()
});

export async function POST({ request, url, locals }) {
  let body;
  try {
    const withTimestamps = url.searchParams.get('withTimestamps') === 'true';
    body = await request.json();
    const validatedData = v.parse(transcribeSchema, body);
    const { audioData, trackId: clientTrackId } = validatedData;

    const auth = await optionalAuth(locals);
    const userId = auth?.id ?? null;

    if (!MISTRAL_API_KEY) {
      return json({ success: false, trackId: clientTrackId, timestamp: new Date().toISOString(), error: "Mistral API key not configured" }, { status: 500 });
    }
    const client = new Mistral({ apiKey : MISTRAL_API_KEY });

    const arrayBuffer = new Uint8Array(audioData.arrayBuffer).buffer;
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    // Use the existing track ID for file storage and database operations
    const trackId = clientTrackId || crypto.randomUUID();
    const ownerDir = userId ? `user-${userId}` : 'anonymous';
    const trackFolder = path.join('tracks', ownerDir, trackId);
    const absFolder = path.join(STORAGE_DIR, trackFolder);
    await fs.mkdir(absFolder, { recursive: true });

    const serverFileName = `${Date.now()}-${audioData.name}`;
    const relPath = path.join(trackFolder, serverFileName);
    const absPath = path.join(STORAGE_DIR, relPath);

    await fs.writeFile(absPath, new Uint8Array(arrayBuffer));

    let dbTrack = null;
    if (userId) {
      try {
        // Only create track if it doesn't exist (using clientTrackId)
        if (clientTrackId) {
          console.log(`[api/transcribe] using existing track id=${clientTrackId} for user=${userId}`);
          // For now, assume the track exists since it was created in the tracks endpoint
          // In a real implementation, you might want to verify the track exists
          dbTrack = { id: clientTrackId, userId, fileName: audioData.name, filePath: relPath };
        } else {
          dbTrack = await createTrack(userId, audioData.name, relPath, undefined, audioData.type.startsWith('video/'));
          console.log(`[api/transcribe] created DB track id=${dbTrack?.id} for user=${userId}`);
        }
      } catch (dbErr) {
        console.error('[api/transcribe] createTrack failed:', dbErr);
      }
    } else if (clientTrackId) {
      // For anonymous users with clientTrackId, we still need to save the transcription
      console.log(`[api/transcribe] anonymous user with clientTrackId=${clientTrackId}, saving transcription only`);
    }

    // Send to Mistral
    const transcriptionRequest: any = {
      model: "voxtral-mini-latest",
      file: {
        fileName: audioData.name,
        content: new Uint8Array(arrayBuffer),
      },
    };
    
    if (withTimestamps) transcriptionRequest.timestampGranularities = ["segment"];
    
    const transcriptionResponse = await client.audio.transcriptions.complete(transcriptionRequest);

    if (!transcriptionResponse.text) {
      return json({
        success: false,
        trackId: clientTrackId,
        timestamp: new Date().toISOString(),
        error: "No transcription text received"
      }, { status: 500 });
    }

    // After transcription success, persist transcription using the track ID
    const trackIdForTranscription = dbTrack?.id || clientTrackId;
    console.log(`[api/transcribe] trackIdForTranscription: ${trackIdForTranscription}, dbTrack: ${dbTrack?.id}, clientTrackId: ${clientTrackId}`);
    
    if (trackIdForTranscription) {
      try {
        const content = withTimestamps ? JSON.stringify(transcriptionResponse) : transcriptionResponse.text;
        const saved = await createTranscription(trackIdForTranscription, content, !!withTimestamps);
        console.log(`[api/transcribe] saved transcription id=${saved?.id} for track=${trackIdForTranscription}`);
      } catch (err) {
        console.error('[api/transcribe] createTranscription failed:', err);
      }
    } else {
      console.warn('[api/transcribe] no track ID available for transcription saving');
    }

    const result = {
      success: true,
      content: withTimestamps ? transcriptionResponse : transcriptionResponse.text,
      trackId: dbTrack ? dbTrack.id : clientTrackId,
      timestamp: new Date().toISOString()
    };
    return json(result);
  } catch (err) {
    const errorResult = {
      success: false,
      trackId: body?.trackId || 'unknown',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error'
    };
    console.error('[api/transcribe] error:', errorResult);
    return json(errorResult, { status: 500 });
  }
}