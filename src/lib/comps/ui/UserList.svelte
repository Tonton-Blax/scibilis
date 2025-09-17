<script lang="ts">
    import { onMount } from 'svelte';
    import { userState, toast } from '$lib/states.svelte';
    import { Button, Table, TableBody, TableHead, TableHeadCell } from 'flowbite-svelte';
    import { PenOutline, DeleteRowOutline, PlusOutline } from 'flowbite-svelte-icons';
    import type { UserWithDetails } from '$lib/server/user-service';
    
    let users = $derived(userState.users);
    let isLoading = $derived(userState.isLoading);
    let error = $derived(userState.error);
    
    let search = $state('');
    let page = $state(1);
    let limit = $state(10);
    
    onMount(async () => {
        await loadUsers();
    });
    
    async function loadUsers() {
        try {
            userState.isLoading = true;
            userState.error = null;
            
            const offset = (page - 1) * limit;
            const response = await fetch(`/api/users?limit=${limit}&offset=${offset}&search=${search}`);
            
            if (!response.ok) {
                throw new Error('Failed to load users');
            }
            
            const data = await response.json();
            userState.users = data;
        } catch (err) {
            userState.error = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.trigger(userState.error, 'red');
        } finally {
            userState.isLoading = false;
        }
    }
    
    async function deleteUser(userId: string) {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete user');
            }
            
            userState.removeUser(userId);
            toast.trigger('User deleted successfully', 'green');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.trigger(errorMsg, 'red');
        }
    }
    
    function handleSearch() {
        page = 1;
        loadUsers();
    }
    
    function handlePageChange(newPage: number) {
        page = newPage;
        loadUsers();
    }
</script>

<div class="p-4 bg-white rounded-lg shadow">
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">User Management</h2>
        <Button href="/users/new" color="blue">
            <PlusOutline class="mr-2" />
            Add User
        </Button>
    </div>
    
    <div class="mb-4 flex">
        <input
            type="text"
            bind:value={search}
            placeholder="Search users..."
            class="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button
            onclick={handleSearch}
            class="rounded-l-none"
        >
            Search
        </Button>
    </div>
    
    {#if isLoading}
        <div class="text-center py-4">
            <p>Loading users...</p>
        </div>
    {:else if error}
        <div class="text-center py-4 text-red-500">
            <p>{error}</p>
        </div>
    {:else if users.length === 0}
        <div class="text-center py-4">
            <p>No users found</p>
        </div>
    {:else}
        <Table>
            <TableHead>
                <TableHeadCell>Username</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
            </TableHead>
            <TableBody>
                {#each users as user (user.id)}
                    <tr>
                        <td>{user.username}</td>
                        <td>{user.name || '-'}</td>
                        <td>{user.email || '-'}</td>
                        <td>
                            <span class="px-2 py-1 text-xs rounded-full {user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                                {user.role}
                            </span>
                        </td>
                        <td>
                            <span class="px-2 py-1 text-xs rounded-full {user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                {user.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <div class="flex space-x-2">
                                <Button
                                    href={`/users/${user.id}/edit`}
                                    size="xs"
                                    color="blue"
                                >
                                    <PenOutline class="w-4 h-4" />
                                </Button>
                                <Button
                                    onclick={() => deleteUser(user.id)}
                                    size="xs"
                                    color="red"
                                >
                                    <DeleteRowOutline class="w-4 h-4" />
                                </Button>
                            </div>
                        </td>
                    </tr>
                {/each}
            </TableBody>
        </Table>
        
        <div class="mt-4 flex justify-between items-center">
            <div>
                <span>Page {page}</span>
            </div>
            <div class="flex space-x-2">
                <Button
                    onclick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    size="xs"
                >
                    Previous
                </Button>
                <Button
                    onclick={() => handlePageChange(page + 1)}
                    disabled={users.length < limit}
                    size="xs"
                >
                    Next
                </Button>
            </div>
        </div>
    {/if}
</div>