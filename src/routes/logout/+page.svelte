<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    
    onMount(async () => {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                // Redirect to login page
                await goto('/login');
            } else {
                console.error('Logout failed');
                // Still redirect to login page even if logout failed
                await goto('/login');
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Still redirect to login page even if there was an error
            await goto('/login');
        }
    });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Logging out...</h2>
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
    </div>
</div>