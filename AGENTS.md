# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test Commands
- Run single test: `bun run test:unit -- src/path/to/test.spec.ts`
- Database migrations: `bun run db:push` (schema changes), `bun run db:migrate` (data changes)
- Admin user is auto-created on server start with username 'admin' and password 'admin123'

## Project-Specific Patterns
- Use Svelte 5 runes ($state, $derived, $effect) for reactivity instead of Svelte 4 syntax
- State management uses custom builder functions in `src/lib/states.svelte.ts` (not stores)
- Authentication: Use `requireAuth(locals, 'admin')` and `optionalAuth(locals)` from auth-utils.ts
- User service: All database operations go through `src/lib/server/user-service.ts`
- Password hashing uses specific Argon2 parameters (memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1)
- FFmpeg is loaded from CDN with specific version in `extractAudio.ts` - don't change without testing

## Code Style (Non-Obvious)
- Use tabs for indentation (configured in .prettierrc)
- Trailing commas are omitted (not standard JavaScript practice)
- FFmpeg imports require `// @ts-ignore` due to type definition issues
- Error handling in API routes must return JSON with format: `{ success: boolean, trackId?: string, timestamp: string, error?: string }`

## Database
- SQLite (BetterSqlite3) with Drizzle ORM(packages drizzle-kit and drizzle-orm) - schema in `src/lib/server/db/schema.ts`
- User IDs are generated with 120 bits of entropy using Base32 encoding
- Session tokens are hashed with SHA256 before storage (never store raw tokens)

## Testing
- Tests must be in same directory as source files (not separate __tests__ folder)
- Server tests only (no Svelte component tests configured)
- Use Vitest with requireAssertions: true


## Available MCP Tools:
https://svelte-llm.stanislav.garden/mcp/mcp
When connected to the svelte-llm MCP server, you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list_sections
Use this FIRST to discover all available documentation sections. Returns a structured list with titles and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get_documentation
Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list_sections tool, you MUST analyze the returned documentation sections and then use the get_documentation tool to fetch ALL documentation sections that are relevant for the users task.