import { ffmpegMessage } from '$lib/states.svelte';
import { FFmpeg } from '@ffmpeg/ffmpeg';
// @ts-ignore
import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let videoEl: HTMLVideoElement;

const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm';

export async function extractAudio(file: File): Promise<Blob> {
	const ffmpeg = new FFmpeg();
	ffmpeg.on('log', ({ message: msg }: LogEvent) => {
		console.log(msg);
		ffmpegMessage.add(msg);
	});
	ffmpegMessage.add('Start extracting audio');
	await ffmpeg.load({
		coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
		wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
		workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
	});

	const inputName = file.name;
	const outputName = `output.mp3`;

  	// Write input file
  	await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(["-i", inputName, "-q:a", "0", "-map", "a", outputName]);
  
	const data = await ffmpeg.readFile(outputName);
	ffmpegMessage.add('Finished extracting audio');
	return new Blob([(data as Uint8Array as any).buffer], {
		type: "audio/mpeg"
	});
}