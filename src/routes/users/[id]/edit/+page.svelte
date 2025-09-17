<script lang="ts">
    import UserForm from '$lib/comps/ui/UserForm.svelte';
    
    let { data } = $props<{ userId: string; isEdit: boolean }>();
</script>

<svelte:head>
    <title>Edit User</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">Edit User</h1>
    <UserForm userId={data.userId} isEdit={data.isEdit} />
</div>