<script lang="ts">
  import { Dropzone, Button, Spinner, Toast, Dropdown, DropdownItem, Modal, Input, Tooltip, Clipboard, Indicator, P } from "flowbite-svelte";
  import { extractAudio } from "$lib/processors/extractAudio";
	import { ffmpegMessage, toast } from "$lib/states.svelte";
	import AudioPlayer from "./AudioPlayer.svelte";
	import { CloseCircleOutline, PenNibOutline, VideoCameraSolid, ExclamationCircleSolid, DownloadOutline, ChevronDownOutline, NewspaperOutline, CheckOutline, ClipboardCleanSolid } from "flowbite-svelte-icons";
	import { slide } from "svelte/transition";
	import { marked } from "marked";
  let filesInDropzone = <FileList | null>$state(null);
  let pendingFiles = $state<PendingFile[]>([]);
  

  let transcribingTracks = $state<Set<string>>(new Set());
  
  let showTranscriptionModal = $state(false);
  let currentTranscription = $state<{ trackId: string; title: string; content: string; timestamp: string } | null>(null);
  
  let { audioTracks = [], messages }: { audioTracks: AudioTrack[]; messages: string[] } = $props();

  async function processFile(file: File): Promise<AudioTrack> {
    const isAudio = file.type.startsWith('audio/');
    const audioBlob = isAudio
      ? new Blob([file], { type: file.type }) // normalize to Blob
      : await extractAudio(file);

    const url = URL.createObjectURL(audioBlob);

    try {
      ffmpegMessage.clear();
    } catch {}

    const title = file.name.replace(/\.[^/.]+$/, "");
    const artist = "Unknown Artist";

    const track: AudioTrack = {
      id: crypto.randomUUID(),
      url,
      title,
      artist,
      originalFile: file,
      wasVideo: !isAudio,
      serverSaved: false
    };

    // Try to persist to server if possible but tolerate 401/other failures
    try {
      const form = new FormData();
      form.set('file', file, file.name);
      form.set('title', title);

      // send credentials so session cookie is included when available
      const res = await fetch('/api/tracks', {
        method: 'POST',
        body: form,
        credentials: 'same-origin'
      });


      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.track && data.track.id) {
          track.id = data.track.id;
          track.serverSaved = true;
        } else {
          toast.trigger('Upload accepted but server returned no id; kept locally', 'orange');
        }
      } else {
        if (res.status === 401) {
          toast.trigger('Not authenticated — track saved locally only. Log in to persist it on the server.', 'orange');
        } else {
          const err = await res.json().catch(() => null);
          toast.trigger('Upload to server failed: ' + (err?.error || res.statusText), 'orange');
        }
      }
    } catch (e) {
      toast.trigger('Upload to server failed: ' + (e instanceof Error ? e.message : String(e)), 'orange');
    }

    return track;
  }

  async function processFilesSequentially(files: FileList) {
    ffmpegMessage.clear();
    
    try {
      // Filter out invalid files (not video or audio)
      const validFiles = Array.from(files).filter(file => {

        const isValid = file.type.startsWith('video/') || file.type.startsWith('audio/');

        if (!isValid) 
          toast.trigger(`File ${file.name} was of the wrong format and has been discarded`, "red");
          
        return isValid;
      });
      
      if (validFiles.length === 0) {
        return; // No valid files to process
      }
      
      // First, add all valid files to pendingFiles state
      const newPendingFiles: PendingFile[] = validFiles.map(file => ({
        id: crypto.randomUUID(),
        file,
        isProcessing: false
      }));
      
      pendingFiles = [...pendingFiles, ...newPendingFiles];
      
      // Process files one by one
      const filesToProcess = [...newPendingFiles];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const pendingFile = filesToProcess[i];
        // Mark this file as processing
        pendingFiles = pendingFiles.map(pf =>
          pf.id === pendingFile.id ? { ...pf, isProcessing: true } : pf
        );
        
        const file = pendingFile.file;
        ffmpegMessage.add(`Processing file ${i + 1}/${filesToProcess.length}: ${file.name}`);
        
        try {
          const track = await processFile(file);
          // Add the processed track to audioTracks immediately
          audioTracks = [...audioTracks, track];          
          pendingFiles = pendingFiles.filter(pf => pf.id !== pendingFile.id);
        } catch (error) {          
          toast.trigger(`Video conversion failed for ${file.name}. ${error}`, "red");
          pendingFiles = pendingFiles.filter(pf => pf.id !== pendingFile.id);          
          continue;
        }
      }      
      ffmpegMessage.add(`Successfully processed ${validFiles.length} file(s)`);

    } catch (error) {
      ffmpegMessage.add(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleOnChange(event: Event) {
    const target = event.target as HTMLInputElement;
    filesInDropzone = target.files;
    if (filesInDropzone?.length) {
      // Start processing but don't wait for it to complete
      processFilesSequentially(filesInDropzone);
    }
  }
  
  async function handleOnDrop(event: DragEvent) {
    event.preventDefault();
    filesInDropzone = event.dataTransfer?.files ?? null;
    if (filesInDropzone?.length) {
      // Start processing but don't wait for it to complete
      processFilesSequentially(filesInDropzone);
    }
  }
  
  function removePendingFile(id: string) {
    const fileToRemove = pendingFiles.find(pf => pf.id === id);
    if (fileToRemove && fileToRemove.isProcessing) {
      // If the file is being processed, we can't remove it yet
      // In a real implementation, you might want to cancel the processing
      return;
    }
    
    pendingFiles = pendingFiles.filter(pf => pf.id !== id);
    
    // Also remove any transcription results for this file
    const audioTrack = audioTracks.find(track => track.originalFile === fileToRemove?.file);
    if (audioTrack) {
      const newTranscribing = new Set(transcribingTracks);
      newTranscribing.delete(audioTrack.id);
      transcribingTracks = newTranscribing;
    }
    
    if (pendingFiles.length === 0 && audioTracks.length === 0) {
      filesInDropzone = null;
      ffmpegMessage.clear();
    }
  }
  
  async function clearAllFiles() {
    // Delete server-saved tracks from database first
    const serverSavedTracks = audioTracks.filter(track => track.serverSaved);
    let deleteErrors = 0;
    
    for (const track of serverSavedTracks) {
      const success = await deleteTrackFromDatabase(track.id);
      if (!success) {
        deleteErrors++;
      }
    }
    
    if (deleteErrors > 0) {
      toast.trigger(`Failed to delete ${deleteErrors} track(s) from server. Removed locally only.`, 'orange');
    }
    
    // Clear all tracks
    audioTracks.forEach(track => {
      if (track.url) {
        URL.revokeObjectURL(track.url);
      }
    });
    audioTracks = [];
    pendingFiles = [];
    transcribingTracks = new Set();
    filesInDropzone = null;
    ffmpegMessage.clear();
  }


  async function handleTranscribe(trackId: string, audioBlob: Blob, withTimestamps: boolean = false) {
    try {
      // Add track to transcribing set
      transcribingTracks = new Set(transcribingTracks).add(trackId);
      
      // Convert blob to array buffer for serialization
      const arrayBuffer = await audioBlob.arrayBuffer();
      const array = Array.from(new Uint8Array(arrayBuffer));
      
      // Call the transcribe API endpoint
      const response = await fetch(`/api/transcribe?withTimestamps=${withTimestamps}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioData: {
            name: `audio-${trackId}.mp3`,
            type: 'audio/mpeg',
            arrayBuffer: array
          },  
          trackId
        })
      });
            
      if (!response.ok) 
        throw new Error(`API request failed with status ${response.status}`);
      
      const result = await response.json();
      
      if (result.success && 'content' in result && result.content) {
        // Store the transcription result directly in the track
        const trackIndex = audioTracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
          const updatedTracks = [...audioTracks];
          updatedTracks[trackIndex] = {
            ...updatedTracks[trackIndex],
            transcriptionContent: [{
              trackId,
              content: withTimestamps ? //@ts-ignore
                result.content.segments?.map(s =>`[${s.start}-${s.end}]\r\n${s.text}`).join('\r\n') + '\r\n\r\n' + `Original Text:\r\n\r\n${result.content.text}`
                : result.content,
              withTimestamps,
              createdAt: new Date().toISOString()
            }]
          };
          audioTracks = updatedTracks;
        }
        
        toast.trigger("Transcription completed successfully!", "green");
      } else {
        const errorMessage = 'error' in result ? result.error : 'Unknown error';
        toast.trigger('Transcription failed: ' + errorMessage, "red");
      }
    } catch (error) {      
      toast.trigger(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "red");
    } finally {
      const newSet = new Set(transcribingTracks);
      newSet.delete(trackId);
      transcribingTracks = newSet;
      setTimeout(() => { toast.close() }, 5000);
    }
  }
  
  function downloadTranscription(trackId: string) {
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !track.transcriptionContent || track.transcriptionContent.length === 0) return;
    
    // Use the first transcription (or combine all)
    const transcription = track.transcriptionContent[0];
    
    // Create a blob with the transcription content
    const blob = new Blob([transcription.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link to download the file
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${trackId}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
  
  function downloadAudio(trackId: string) {
    const track = audioTracks.find(t => t.id === trackId);
    if (!track) return;
    
    // Create a temporary link to download the audio file
    const a = document.createElement('a');
    if (track.url) {
      a.href = track.url;
    }
    a.download = `${track.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
    }, 0);
  }
  
  function viewTranscription(trackId: string) {
    const track = audioTracks.find(t => t.id === trackId);
    if (track && track.transcriptionContent && track.transcriptionContent.length > 0) {
      currentTranscription = {
        trackId,
        title: track.title,
        content: track.transcriptionContent[0].content,
        timestamp: track.transcriptionContent[0].createdAt
      };
      showTranscriptionModal = true;
    }
  }
  
  async function deleteTrackFromDatabase(trackId: string) {
    try {
      const response = await fetch(`/api/tracks/${trackId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
</script>

<Dropzone
  multiple
  id="my-awesome-dropzone"
  bind:files={filesInDropzone}
  onChange={handleOnChange}
  onDrop={handleOnDrop}
  accept="video/*,audio/*"
>
   <svg aria-hidden="true" class="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg> 
    <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
      <span class="font-semibold">Click to upload</span> or drag and drop
    </p>
    <p class="text-xs text-gray-500 dark:text-gray-400">Any video or audio file</p>
 
</Dropzone>


{#if filesInDropzone?.length || audioTracks.length > 0 || pendingFiles.length > 0}
  <div class="mt-4 w-full max-w-2xl">
    <!-- Display pending files (being processed) -->
    {#each pendingFiles as pendingFile (pendingFile.id)}
      <div class="mb-2 flex flex-row gap-x-2 items-center justify-start">
        <div class="flex items-center gap-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex-1 w-72 h-[3.75rem]">
          {#if pendingFile.isProcessing}
            <Spinner class="h-6 w-6" />
            <span class="text-sm font-medium">{ffmpegMessage.lastMessage}</span>
          {:else}
            <VideoCameraSolid class="h-6 w-6 text-gray-500" />
          {/if}
          <span class="text-sm font-medium">{pendingFile.file.name}</span>
        </div>

        <Button color="red" class="h-[3.75rem] cursor-pointer" disabled={pendingFile.isProcessing}
          onclick={() => removePendingFile(pendingFile.id)}>
          <CloseCircleOutline class="shrink-0 h-8 w-8" />
        </Button>
      </div>
    {/each}
    
    <!-- Display processed audio tracks -->
    {#each audioTracks as track (track.id)}
      <div class="mb-2 flex flex-row gap-x-2 items-center justify-start">

        {#if transcribingTracks.has(track.id)}
          <Button color="primary" class="h-[3.75rem] cursor-pointer w-[24rem]" disabled>
            <Spinner class="h-6 w-6 mr-2" />
            Transcription en cours...
          </Button>
        {:else if track.url}
          <AudioPlayer
            src={track.url}
            title={track.title}
            artist={track.artist}
          />
        {:else if track.transcriptionContent && track.transcriptionContent.length > 0}
          <!-- Placeholder for tracks with transcription but missing audio -->
          <div class="flex items-center gap-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex-1 w-[24rem] h-[3.75rem]">
            <ExclamationCircleSolid class="h-6 w-6 text-yellow-500" />
            <div class="flex-1">
              <span class="text-sm font-medium">{track.title}</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">Audio file missing - transcription available</p>
            </div>
          </div>
        {:else}
          <!-- Placeholder for tracks with missing audio and no transcription -->
          <div class="flex items-center gap-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex-1 w-[24rem] h-[3.75rem]">
            <ExclamationCircleSolid class="h-6 w-6 text-red-500" />
            <div class="flex-1">
              <span class="text-sm font-medium">{track.title}</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">Audio file missing</p>
            </div>
          </div>
        {/if}

        <Button  color="green" class="h-[3.75rem] cursor-pointer relative">
          {#if track.transcriptionContent && track.transcriptionContent.length > 0}
           <span class="sr-only">Notifications</span>
          <Indicator color="green" border size="xl" placement="top-right" class="text-xs font-bold babouin">✓</Indicator>
          {/if}
          Transcription
          <ChevronDownOutline class="ms-2 h-6 w-6 text-white dark:text-white" />
        </Button>
        <Dropdown simple class="p-4">
          <DropdownItem
            onclick={() => {
              if (track.url) {
                fetch(track.url)
                  .then(response => response.blob())
                  .then(blob => handleTranscribe(track.id, blob, false));
              }
            }}
            class="flex flex-row space-x-2 items-center w-full mx-auto cursor-pointer">
            <PenNibOutline class="shrink-0 h-8 w-8" />
            <span>Transcrire</span>
          </DropdownItem>
          <DropdownItem
            onclick={() => {
              if (track.url) {
                fetch(track.url)
                  .then(response => response.blob())
                  .then(blob => handleTranscribe(track.id, blob, true));
              }
            }}
            class="flex flex-row space-x-2 items-center w-full mx-auto cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg"class="shrink-0 h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M5.75024 3.5H4.71733L3.25 3.89317V5.44582L4.25002 5.17782L4.25018 8.5H3V10H7V8.5H5.75024V3.5ZM10 4H21V6H10V4ZM10 11H21V13H10V11ZM10 18H21V20H10V18ZM2.875 15.625C2.875 14.4514 3.82639 13.5 5 13.5C6.17361 13.5 7.125 14.4514 7.125 15.625C7.125 16.1106 6.96183 16.5587 6.68747 16.9167L6.68271 16.9229L5.31587 18.5H7V20H3.00012L2.99959 18.8786L5.4717 16.035C5.5673 15.9252 5.625 15.7821 5.625 15.625C5.625 15.2798 5.34518 15 5 15C4.67378 15 4.40573 15.2501 4.37747 15.5688L4.3651 15.875H2.875V15.625Z"></path></svg>
            <span>Transcrire avec Timecodes</span>
          </DropdownItem>
          <DropdownItem
            disabled={!track.transcriptionContent || track.transcriptionContent.length === 0}
            class="flex flex-row space-x-2 items-center w-full mx-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={() => downloadTranscription(track.id)}
          >
            <DownloadOutline class="shrink-0 h-8 w-8" />
            <span>Télécharger la transcription</span>
          </DropdownItem>
          <DropdownItem
            disabled={!track.transcriptionContent || track.transcriptionContent.length === 0}
            class="flex flex-row space-x-2 items-center w-full mx-auto cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={() => viewTranscription(track.id)}
          >
            <NewspaperOutline class="shrink-0 h-8 w-8" />
            <span>Voir la transcription</span>
          </DropdownItem>
        </Dropdown>

                
        {#if track.wasVideo}
          <Button color="blue" class="h-[3.75rem] cursor-pointer" title="Download audio file"
            onclick={() => downloadAudio(track.id)}>
            <svg class="shrink-0 h-8 w-8 fill-white" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 512 512"> <path class="st0" d="M455.7,108.4c5.1,5.1,10.2,12.8,13.7,21.3,3.4,9.4,6,17.9,6,24.7v329.4c0,7.7-2.6,14.5-7.7,19.6-5.1,5.1-11.9,8.5-19.6,8.5H64c-7.7,0-14.5-2.6-19.6-7.7-5.1-5.1-7.7-11.9-7.7-19.6V27.3c0-7.7,2.6-14.5,7.7-19.6S56.3,0,64,0h256c7.7,0,16.2,1.7,24.7,6,9.4,3.4,16.2,8.5,21.3,13.7l89.6,88.7ZM329.4,39.3v107.5h107.5c-1.7-5.1-4.3-9.4-6-11.9l-90.5-89.6c-1.7-2.6-6-4.3-11.1-6ZM438.6,475.3V182.6h-118.6c-7.7,0-14.5-2.6-19.6-7.7-5.1-5.1-7.7-11.9-7.7-19.6V36.7H73.4v438.6h365.2ZM213.3,243.2c3.4,1.7,6,4.3,6,8.5v155.3c0,4.3-1.7,6.8-6,8.5-1.7,0-2.6.9-3.4.9-2.6,0-4.3-.9-6.8-2.6l-47.8-47.8h-37.5c-2.6,0-5.1-.9-6.8-2.6-1.7-1.7-2.6-4.3-2.6-6.8v-54.6c0-2.6.9-5.1,2.6-6.8,1.7-1.7,4.3-2.6,6.8-2.6h37.5l47.8-47.8c3.4-2.6,6.8-3.4,10.2-1.7ZM332.8,439.5c6,0,11.1-2.6,14.5-6.8,24.7-29.9,36.7-64.9,36.7-104.1s-11.9-73.4-36.7-104.1c-3.4-4.3-6.8-6-11.9-6.8-5.1-.9-9.4.9-13.7,4.3-4.3,3.4-6,7.7-6.8,12.8-.9,5.1.9,9.4,4.3,13.7,18.8,23,28.2,50.3,28.2,80.2s-9.4,57.2-28.2,80.2c-3.4,4.3-4.3,8.5-4.3,13.7.9,5.1,2.6,9.4,6.8,11.9,3.4,4.3,6.8,5.1,11.1,5.1ZM272.2,397.7c5.1,0,9.4-1.7,13.7-6,16.2-17.9,24.7-38.4,24.7-62.3s-8.5-45.2-24.7-62.3c-3.4-3.4-7.7-5.1-12.8-6-5.1,0-9.4,1.7-12.8,5.1-3.4,3.4-5.1,7.7-6,12.8,0,5.1,1.7,9.4,5.1,13.7,10.2,11.1,14.5,23,14.5,37.5s-5.1,26.5-14.5,37.5c-3.4,3.4-5.1,8.5-5.1,13.7s1.7,9.4,6,12.8c3.4,1.7,7.7,3.4,11.9,3.4Z"/></svg>
          </Button>
        {/if}


        <Button color="red" class="h-[3.75rem]"
          onclick={async () => {
            // If track is saved on server, delete it from database first
            if (track.serverSaved) {
              const success = await deleteTrackFromDatabase(track.id);
              if (!success) {
                toast.trigger('Failed to delete track from server. Removed locally only.', 'orange');
              }
            }
            
            // Remove this specific track
            if (track.url) {
              URL.revokeObjectURL(track.url);
            }
            audioTracks = audioTracks.filter(t => t.id !== track.id);
            
            // Also remove any transcription results for this track
            const newTranscribing = new Set(transcribingTracks);
            newTranscribing.delete(track.id);
            transcribingTracks = newTranscribing;
            
            if (audioTracks.length === 0) {
              filesInDropzone = null;
              ffmpegMessage.clear();
            }
          }}>
          <CloseCircleOutline class="shrink-0 h-8 w-8" />
        </Button>

      </div>
    {/each}
    
    {#if audioTracks.length > 0 || pendingFiles.length > 0}
      <div class="mt-4 flex justify-start h-[3.75rem] cursor-pointer">
        <Button color="red"
          onclick={clearAllFiles}>
          Tout supprimer
          <CloseCircleOutline class="shrink-0 h-5 w-5 ml-2" />
        </Button>
      </div>
    {/if}
  </div>
{/if}

<!-- Transcription Modal -->
{#if currentTranscription}
  <Modal form bind:open={showTranscriptionModal} size="xl" transition={slide}>
      
    
    {#snippet header()}

      <div class="flex justify-between items-center">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          Transcription: {currentTranscription?.title}
        </h3>
        
      </div>
      {/snippet}

      <div>        
          <P class="w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
        {@html marked(currentTranscription.content)}
        </P>
      </div>
      {#snippet footer()}
      <div class="flex justify-end space-x-2">
        
        <Button
          color="alternative"
          onclick={() => showTranscriptionModal = false}
        >
          Close
        </Button>
        <Button
          color="blue"
          onclick={() => {
            if (currentTranscription) {
              downloadTranscription(currentTranscription.trackId);
            }
          }}
        >
          <DownloadOutline class="mr-2 h-5 w-5" />
          Download
        </Button>
        {#if currentTranscription?.content}
        <Clipboard bind:value={currentTranscription.content} class="!bg-gray-500">
          {#snippet children(success)}
            <Tooltip isOpen={success}>
              {success ? "Copied" : "Copy to clipboard"}
            </Tooltip>
            {#if success}
              <CheckOutline class="h-5 w-5" />
            {:else}
              <ClipboardCleanSolid class="h-5 w-5" />
            {/if}
          {/snippet}
        </Clipboard>
        {/if}
      </div>
      {/snippet}
  </Modal>
{/if}

<!-- Toast for error notifications -->
{#if toast.show}
  <Toast color={toast.color} bind:toastStatus={toast.show}>
    {#snippet icon()}
      <ExclamationCircleSolid class="h-5 w-5" />
      <span class="sr-only">Error icon</span>
    {/snippet}
    {toast.message}
  </Toast>
{/if}

<!-- Minimal markup so this component compiles -->
<div class="dropzone-component">
	<!-- dropzone UI is implemented elsewhere; keep placeholder -->
</div>

