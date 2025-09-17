<script lang="ts">
    import UserList from '$lib/comps/ui/UserList.svelte';
</script>

<svelte:head>
    <title>User Management</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">User Management</h1>
    <UserList />
</div>