import { getTranscriptionsByTrack } from '$lib/server/user-service';
import type { PageServerLoad } from './$types';

interface TrackStats {
  loaded: number;
  transcriptionOnly: number;
  removed: number;
}

export const load = (async ({ locals, fetch }) => {
  const audioTracks: AudioTrack[] = [];
  const messages: string[] = [''];
  
  try {
    const response = await fetch('/api/tracks');
    if (!response.ok) throw new Error('Failed to fetch tracks');
    
    const tracks = await response.json();
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { user: locals.user };
    }

    const stats: TrackStats = { loaded: 0, transcriptionOnly: 0, removed: 0 };
    
    const processedTracks = await Promise.all(
      tracks.map(track => processTrack(track, messages, stats, fetch))
    );
    
    // Filter valid tracks and update audioTracks
    audioTracks.push(...processedTracks.filter(Boolean) as AudioTrack[]);
    
    // Generate summary messages
    generateSummaryMessages(stats, messages);
    
  } catch (error) {
    console.error('[DropZone] Failed to load saved tracks:', error);
    // Silent fail - expected when user is not authenticated
  }
  
  return { user: locals.user, audioTracks, messages };
}) satisfies PageServerLoad;

async function processTrack(
  track: any,
  messages: string[],
  stats: TrackStats, 
  fetch: typeof globalThis.fetch
): Promise<AudioTrack | null> {
  const baseTrack = {
    id: track.id,
    title: track.title || track.fileName,
    artist: "Unknown Artist",
    originalFile: new File([], track.fileName),
    wasVideo: track.wasVideo,
    serverSaved: true
  };

  let audioUrl: string | null = null;
  let transcriptionData: any = null;

  // Check for audio
  if (track.filePath) {
    audioUrl = `/api/tracks/${track.id}`;
  }

  // Always try to get transcription
  try {
    transcriptionData = await getTranscriptionsByTrack(track.id);
    console.log(`--TRANSCRIPTIOn Fetched transcription for track ${track.id}`, transcriptionData);
  } catch (error) {
    console.error(`Failed to fetch transcription for track ${track.id}:`, error);
  }

  // If we have either audio or transcription, return the track
  if (audioUrl || transcriptionData) {
    if (audioUrl && transcriptionData) {
      stats.loaded++; // Both audio and transcription
    } else if (transcriptionData) {
      stats.transcriptionOnly++; // Only transcription
    } else {
      stats.loaded++; // Only audio
    }

    return {
      ...baseTrack,
      url: audioUrl,
      transcriptionContent: transcriptionData
    };
  }

  // Neither available, delete track
  return await deleteOrphanedTrack(track, messages, stats, fetch);
}
async function deleteOrphanedTrack(
  track: any, 
  messages: string[], 
  stats: TrackStats,
  fetch: typeof globalThis.fetch
): Promise<null> {
  try {
    const deleteResponse = await fetch(`/api/tracks/${track.id}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    
    const trackName = track.title || track.fileName;
    
    if (deleteResponse.ok) {
      console.log(`[DropZone] Deleted orphaned track: ${track.id}`);
      messages.push(`Removed missing track: ${trackName}`);
      stats.removed++;
    } else {
      throw new Error('Delete request failed');
    }
  } catch (error) {
    console.error('[DropZone] Failed to delete orphaned track:', error);
    messages.push(`Failed to remove missing track: ${track.title || track.fileName}`);
  }
  
  return null;
}

function generateSummaryMessages(stats: TrackStats, messages: string[]): void {
  const { loaded, transcriptionOnly, removed } = stats;
  
  if (loaded > 0) {
    messages.push(`Loaded ${loaded} saved track(s)`, "green");
    console.log(`[DropZone] Loaded ${loaded} saved track(s) from server`);
  }
  
  if (transcriptionOnly > 0) {
    messages.push(`Found ${transcriptionOnly} track(s) with transcription only (audio file missing)`, "orange");
    console.log(`Found ${transcriptionOnly} track(s) with transcription only (audio file missing)`);
  }
  
  if (removed > 0) {
    console.log(`[DropZone] Removed ${removed} orphaned track(s)`);
  }
}