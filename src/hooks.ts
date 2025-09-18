import { deLocalizeUrl } from '$lib/paraglide/runtime';
import type { Transport } from '@sveltejs/kit';

// Define a File transport for SvelteKit
export const transport: Transport = {
    File: {
        encode: (value) => value instanceof File && [value.name, value.type, value.size, value.lastModified],
        decode: ([name, type, size, lastModified]) => new File([], name, { type, lastModified })
    }
};

export const reroute = (request) => deLocalizeUrl(request.url).pathname;
