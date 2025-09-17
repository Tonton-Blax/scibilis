<script lang="ts">
    import UserForm from '$lib/comps/ui/UserForm.svelte';
    
    let { data } = $props<{ isEdit: boolean }>();
</script>

<svelte:head>
    <title>Create User</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">Create User</h1>
    <UserForm userId={null} isEdit={data.isEdit} />
</div>