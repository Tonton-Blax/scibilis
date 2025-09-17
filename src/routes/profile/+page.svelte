<script lang="ts">
    import { onMount } from 'svelte';
    import { Button, Input, Label, Textarea } from 'flowbite-svelte';
    import { ArrowLeftOutline, ShareAllOutline } from 'flowbite-svelte-icons';
    import { toast } from '$lib/states.svelte';

    let user = $state<any>(null);
    let formData = $state({
        username: '',
        email: '',
        name: '',
        bio: ''
    });
    let isSubmitting = $state(false);
    let isEditing = $state(false);
    
    onMount(async () => {
        await loadUserProfile();
    });
    
    async function loadUserProfile() {
        try {
            const response = await fetch('/api/auth/profile');
            
            if (!response.ok) {
                throw new Error('Failed to load user profile');
            }
            
            user = await response.json();
            formData = {
                username: user.username,
                email: user.email || '',
                name: user.name || '',
                bio: user.bio || ''
            };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.trigger(errorMsg, 'red');
        }
    }
    
    async function handleSubmit() {
        try {
            isSubmitting = true;
            
            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }
            
            const updatedUser = await response.json();
            user = updatedUser;
            
            toast.trigger('Profile updated successfully', 'green');
            isEditing = false;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.trigger(errorMsg, 'red');
        } finally {
            isSubmitting = false;
        }
    }
    
    function toggleEdit() {
        isEditing = !isEditing;
        if (!isEditing) {
            // Reset form data if canceling edit
            formData = {
                username: user.username,
                email: user.email || '',
                name: user.name || '',
                bio: user.bio || ''
            };
        }
    }
</script>

<svelte:head>
    <title>User Profile</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">User Profile</h1>
        <Button href="/" color="gray">
            <ArrowLeftOutline class="mr-2" />
            Back to Home
        </Button>
    </div>
    
    {#if user}
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Your Profile</h2>
                <div class="flex space-x-2">
                    {#if isEditing}
                        <Button color="gray" onclick={toggleEdit}>Cancel</Button>
                        <Button 
                            color="blue" 
                            onclick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            <ShareAllOutline class="mr-2" />
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    {:else}
                        <Button color="blue" onclick={toggleEdit}>Edit Profile</Button>
                    {/if}
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label for="username" class="block mb-2">Username</Label>
                    {#if isEditing}
                        <Input
                            id="username"
                            bind:value={formData.username}
                            disabled={isSubmitting}
                        />
                    {:else}
                        <p class="p-2 bg-gray-50 rounded">{user.username}</p>
                    {/if}
                </div>
                
                <div>
                    <Label for="email" class="block mb-2">Email</Label>
                    {#if isEditing}
                        <Input
                            id="email"
                            type="email"
                            bind:value={formData.email}
                            disabled={isSubmitting}
                        />
                    {:else}
                        <p class="p-2 bg-gray-50 rounded">{user.email || 'Not provided'}</p>
                    {/if}
                </div>
                
                <div>
                    <Label for="name" class="block mb-2">Full Name</Label>
                    {#if isEditing}
                        <Input
                            id="name"
                            bind:value={formData.name}
                            disabled={isSubmitting}
                        />
                    {:else}
                        <p class="p-2 bg-gray-50 rounded">{user.name || 'Not provided'}</p>
                    {/if}
                </div>
                
                <div>
                    <Label for="role" class="block mb-2">Role</Label>
                    <p class="p-2 bg-gray-50 rounded">{user.role}</p>
                </div>
                
                <div>
                    <Label for="status" class="block mb-2">Status</Label>
                    <p class="p-2 bg-gray-50 rounded">
                        {user.isActive ? 'Active' : 'Inactive'}
                    </p>
                </div>
                
                <div>
                    <Label for="joined" class="block mb-2">Joined</Label>
                    <p class="p-2 bg-gray-50 rounded">
                        {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
            
            <div class="mt-6">
                <Label for="bio" class="block mb-2">Bio</Label>
                {#if isEditing}
                    <Textarea
                        id="bio"
                        bind:value={formData.bio}
                        rows={3}
                        disabled={isSubmitting}
                    />
                {:else}
                    <p class="p-2 bg-gray-50 rounded whitespace-pre-wrap">
                        {user.bio || 'No bio provided'}
                    </p>
                {/if}
            </div>
        </div>
    {:else}
        <div class="bg-white rounded-lg shadow p-6 text-center">
            <p>Loading profile...</p>
        </div>
    {/if}
</div>