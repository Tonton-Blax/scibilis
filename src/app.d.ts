// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {

	  interface AudioTrack {
		id: string;
		url: string | null;
		title: string;
		artist: string;
		originalFile: File;
		wasVideo: boolean;
		serverSaved: boolean;
		hasTranscription?: boolean;
		transcriptionContent?: Transcription[] | null;
	}

	interface Transcription {
		trackId: string;
		content: string;
		withTimestamps: boolean;
		createdAt: string;
	}

	interface PendingFile {
		id: string;
		file: File;
		isProcessing: boolean;
	}

	interface TranscriptionResult { 
		trackId: string;
		content: string;
		timestamp: string;
	}


	
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionValidationResult['user'];
			session: import('$lib/server/auth').SessionValidationResult['session'];
		}
	} // interface Error {}
	// interface Locals {}
} // interface PageData {}
// interface PageState {}

// interface Platform {}
export {};
