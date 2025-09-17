import { Mistral } from "@mistralai/mistralai";
import * as v from 'valibot';
import { error, json } from '@sveltejs/kit';
import { MISTRAL_API_KEY } from "$env/static/private";

// Define the schema for validating the input
const transcribeSchema = v.object({
  audioData: v.object({
    name: v.string(),
    type: v.string(),
    arrayBuffer: v.array(v.number())
  }),
  trackId: v.string()
});

export async function POST({ request, url }) {
  let body;
  try {
    const withTimestamps = url.searchParams.get('withTimestamps') === 'true';
    body = await request.json();    
    const validatedData = v.parse(transcribeSchema, body);
    const { audioData, trackId } = validatedData;
        
    if (!MISTRAL_API_KEY) {
      return json({
        success: false,
        trackId,
        timestamp: new Date().toISOString(),
        error: "Mistral API key not configured"
      }, { status: 500 });
    }
    const client = new Mistral({ apiKey : MISTRAL_API_KEY });
    const arrayBuffer = new Uint8Array(audioData.arrayBuffer).buffer;

    const transcriptionRequest: any = {
      model: "voxtral-mini-latest",
      file: {
        fileName: audioData.name,
        content: new Uint8Array(arrayBuffer),
      },
    };
    
    if (withTimestamps) 
      transcriptionRequest.timestampGranularities = ["segment"];
    
    const transcriptionResponse = await client.audio.transcriptions.complete(transcriptionRequest);

    if (!transcriptionResponse.text) {
      return json({
        success: false,
        trackId,
        timestamp: new Date().toISOString(),
        error: "No transcription text received"
      }, { status: 500 });
    }
    const result = {
      success: true,
      content: withTimestamps ? transcriptionResponse : transcriptionResponse.text,
      trackId,
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
    return json(errorResult, { status: 500 });
  }
}