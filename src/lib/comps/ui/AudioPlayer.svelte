<script lang="ts">
	let { src, title, artist } = $props();

	let time = $state(0);
	let duration = $state(0);
	let paused = $state(true);
	let audioError = $state(false);
	let isSeeking = $state(false);
	let audioReady = $state(false);
	let isLoading = $state(true);

	function format(time: number): string {
		if (isNaN(time)) return '...';

		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);

		return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
	}

	// Handle audio errors
	function handleAudioError() {
		audioError = true;
		console.error('Audio playback failed:', src);
	}

	// Handle audio loaded metadata
	function handleLoadedMetadata() {
		isLoading = false;
		audioReady = true;
		console.log('[AudioPlayer] Audio metadata loaded, duration:', duration);
	}

	// Handle audio canplay event
	function handleCanPlay() {
		isLoading = false;
		audioReady = true;
		console.log('[AudioPlayer] Audio can play, ready for seeking');
	}

	// Handle audio waiting event
	function handleWaiting() {
		isLoading = true;
		console.log('[AudioPlayer] Audio waiting for data');
	}

	// Handle audio playing event
	function handlePlaying() {
		isLoading = false;
		console.log('[AudioPlayer] Audio started playing');
	}

	// Handle audio stalled event
	function handleStalled() {
		isLoading = true;
		console.warn('[AudioPlayer] Audio playback stalled');
	}

	// Safe seek function that waits for audio to be ready
	async function safeSeek(targetTime: number) {
		// Validate target time
		if (isNaN(targetTime) || targetTime < 0) {
			console.warn('[AudioPlayer] Invalid seek time:', targetTime);
			return;
		}

		if (!audioReady) {
			console.log('[AudioPlayer] Audio not ready, waiting...');
			// Wait for audio to load with a timeout
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Audio load timeout')), 2000)
			);
			
			try {
				await Promise.race([
					new Promise(resolve => {
						// Check periodically if audio is ready
						const checkInterval = setInterval(() => {
							if (audioReady) {
								clearInterval(checkInterval);
								resolve(true);
							}
						}, 50);
						
						// Also resolve if duration is available (audio is loading)
						if (duration > 0) {
							clearInterval(checkInterval);
							resolve(true);
						}
					}),
					timeoutPromise
				]);
			} catch (error) {
				console.warn('[AudioPlayer] Audio load timeout, attempting seek anyway:', error);
			}
		}
		
		try {
			// Ensure target time doesn't exceed duration
			const clampedTime = Math.min(targetTime, duration || 0);
			time = clampedTime;
			console.log('[AudioPlayer] Seeking to:', clampedTime, 'of', duration);
		} catch (error) {
			console.error('[AudioPlayer] Seek error:', error);
			audioError = true;
		}
	}
</script>

<div class={['player', 'rounded-lg', { paused, 'audio-error': audioError, 'loading': isLoading }]}>
	<audio
		{src}
		bind:currentTime={time}
		bind:duration
		bind:paused
		onended={() => {
			time = 0;
		}}
		onerror={handleAudioError}
		onloadedmetadata={handleLoadedMetadata}
		oncanplay={handleCanPlay}
		onwaiting={handleWaiting}
		onplaying={handlePlaying}
		onstalled={handleStalled}
		onemptied={() => {
			isLoading = true;
			audioReady = false;
		}}
	></audio>

	<button
		class="play"
		aria-label={paused ? 'play' : 'pause'}
		onclick={() => paused = !paused}
	></button>

	<div class="info">
		{#if audioError}
			<div class="error-message">
				<span>⚠️ Audio playback failed</span>
			</div>
		{:else}
			<div class="description">
				<strong>{title}</strong>
				<!-- <span>{artist}</span> -->
			</div>

			<div class="time cursor-col-resize">
				<span>{format(time)}</span>
				<div
					class="slider"
					onpointerdown={e => {
						const div = e.currentTarget;
						isSeeking = true;

						function seek(e: PointerEvent) {
							const { left, width } = div.getBoundingClientRect();

							let p = (e.clientX - left) / width;
							if (p < 0) p = 0;
							if (p > 1) p = 1;

							const targetTime = p * duration;
							safeSeek(targetTime);
						}

						seek(e);

						window.addEventListener('pointermove', seek);

						window.addEventListener('pointerup', () => {
							window.removeEventListener('pointermove', seek);
							isSeeking = false;
						}, {
							once: true
						});
					}}
				>
					<div class="progress" style="--progress: {isSeeking ? (time / duration) * 100 : time / duration}%"></div>
				</div>
				<span>{duration ? format(duration) : '--:--'}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.player {
		display: grid;
		grid-template-columns: 2.5em 1fr;
		align-items: center;
		gap: 1em;
		padding: 0.5em 1em 0.5em 0.5em;
		height: 3.75rem;
		background: var(--color-gray-500);
		transition: filter 0.2s;
		color: var(--color-gray-100);
		user-select: none;
		width: 21.5rem;
	}

	.player:not(.paused) {
		color: var(--color-blue-200);
		filter: drop-shadow(0.5em 0.5em 1em rgba(0,0,0,0.1));
	}

	.player.audio-error {
		background: var(--color-red-500);
		color: var(--color-gray-100);
	}

	.player.loading {
		opacity: 0.7;
		pointer-events: none;
	}

	.player.loading .play {
		opacity: 0.5;
	}

	button {
		width: 100%;
		aspect-ratio: 1;
		background-repeat: no-repeat;
		background-position: 50% 50%;
		border-radius: 50%;
	}

	[aria-label="pause"] {
		cursor: pointer;
		background-image: url(./pause.svg);
	}

	[aria-label="play"] {
		cursor: pointer;
		background-image: url(./play.svg);
	}

	.info {
		overflow: hidden;
	}

	.description {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.error-message {
		color: var(--color-red-200);
		font-size: 0.8em;
		text-align: center;
		padding: 0.5em;
	}

	.time {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}

	.time span {
		font-size: 0.7em;
	}

	.slider {
		flex: 1;
		height: 0.5em;
		background: var(--color-gray-100);
		border-radius: 0.5em;
		overflow: hidden;
	}

	.progress {
		width: calc(100 * var(--progress));
		height: 100%;
		background: var(--color-blue-500);
	}
</style>
