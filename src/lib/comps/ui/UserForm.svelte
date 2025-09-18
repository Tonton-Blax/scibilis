<script lang="ts">
    import { onMount } from 'svelte';
    import { userFormState, toast } from '$lib/states.svelte';
    import { Button, Input, Label, Select, Textarea } from 'flowbite-svelte';
    import { ArrowLeftOutline, ShareAllOutline } from 'flowbite-svelte-icons';
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    let { userId = null, isEdit = false } = $props<{ userId?: string | null; isEdit?: boolean }>();
    
    let formData = $derived(userFormState.formData);
    let errors = $derived(userFormState.errors);
    let isSubmitting = $derived(userFormState.isSubmitting);
    
    onMount(() => {
        if (isEdit && userId) {
            loadUser(userId);
        }
    });
    
    async function loadUser(id: string) {
        try {
            const response = await fetch(`/api/users/${id}`);
            
            if (!response.ok) {
                throw new Error('Failed to load user');
            }
            const data = await response.json();
            // populate form state with fetched data (keep fields expected by form)
            userFormState.formData = {
                username: data.username ?? '',
                email: data.email ?? '',
                name: data.name ?? '',
                password: '',
                confirmPassword: '',
                role: data.role ?? 'user',
                isActive: data.isActive ?? true,
                bio: data.bio ?? ''
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error loading user';
            toast.trigger(msg, 'red');
        }
    }
    
    function setField(field: string, value: any) {
        userFormState.setField(field, value);
    }
    
    async function validateForm(): Promise<boolean> {
        userFormState.clearErrors();
        let isValid = true;
        
        // Validate username
        if (!formData.username) {
            userFormState.setFieldError('username', 'Username is required');
            isValid = false;
        } else {
            const isAvailable = await isUsernameAvailable(formData.username, userId || undefined);
            if (!isAvailable) {
                userFormState.setFieldError('username', 'Username is already taken');
                isValid = false;
            }
        }
        
        // Validate email
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
            userFormState.setFieldError('email', 'Please enter a valid email address');
            isValid = false;
        } else if (formData.email) {
            const isAvailable = await isEmailAvailable(formData.email, userId || undefined);
            if (!isAvailable) {
                userFormState.setFieldError('email', 'Email is already in use');
                isValid = false;
            }
        }
        
        // Validate password (only required for new users)
        if (!isEdit && !formData.password) {
            userFormState.setFieldError('password', 'Password is required');
            isValid = false;
        } else if (formData.password && formData.password.length < 8) {
            userFormState.setFieldError('password', 'Password must be at least 8 characters');
            isValid = false;
        }
        
        // Validate confirm password
        if (formData.password && formData.password !== formData.confirmPassword) {
            userFormState.setFieldError('confirmPassword', 'Passwords do not match');
            isValid = false;
        }
        
        return isValid;
    }
    
    async function handleSubmit() {
        if (!(await validateForm())) {
            return;
        }
        
        try {
            userFormState.isSubmitting = true;
            
            const payload = {
                username: formData.username,
                email: formData.email || undefined,
                name: formData.name || undefined,
                role: formData.role,
                isActive: formData.isActive,
                bio: formData.bio || undefined
            };
            
            // Only include password if it's provided
            if (formData.password) {
                (payload as any).password = formData.password;
            }
            
            const url = isEdit && userId ? `/api/users/${userId}` : '/api/users';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save user');
            }
            
            const savedUser = await response.json();
            
            toast.trigger(
                isEdit ? 'User updated successfully' : 'User created successfully',
                'green'
            );
            
            // Redirect to user list
            window.location.href = '/users';
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.trigger(errorMsg, 'red');
        } finally {
            userFormState.isSubmitting = false;
        }
    }
</script>

<div class="p-4 bg-white rounded-lg shadow">
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">
            {isEdit ? 'Edit User' : 'Create New User'}
        </h2>
        <Button href="/users" color="gray">
            <ArrowLeftOutline class="mr-2" />
            Back to Users
        </Button>
    </div>
    
    <form onsubmit={handleSubmit}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Label for="username" class="block mb-2">Username *</Label>
                <Input
                    id="username"
                    bind:value={formData.username}
                    oninput={(e) => setField('username', (e.target as HTMLInputElement).value)}
                    class={errors.username ? 'border-red-500' : ''}
                />
                {#if errors.username}
                    <p class="mt-1 text-sm text-red-600">{errors.username}</p>
                {/if}
            </div>
            
            <div>
                <Label for="email" class="block mb-2">Email</Label>
                <Input
                    id="email"
                    type="email"
                    bind:value={formData.email}
                    oninput={(e) => setField('email', (e.target as HTMLInputElement).value)}
                    class={errors.email ? 'border-red-500' : ''}
                />
                {#if errors.email}
                    <p class="mt-1 text-sm text-red-600">{errors.email}</p>
                {/if}
            </div>
            
            <div>
                <Label for="name" class="block mb-2">Full Name</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    oninput={(e) => setField('name', (e.target as HTMLInputElement).value)}
                />
            </div>
            
            <div>
                <Label for="role" class="block mb-2">Role</Label>
                <Select
                    id="role"
                    bind:value={formData.role}
                    onchange={(e) => setField('role', (e.target as HTMLSelectElement).value)}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </Select>
            </div>
            
            <div>
                <Label for="password" class="block mb-2">
                    Password {!isEdit ? '*' : '(leave blank to keep current)'}
                </Label>
                <Input
                    id="password"
                    type="password"
                    bind:value={formData.password}
                    oninput={(e) => setField('password', (e.target as HTMLInputElement).value)}
                    class={errors.password ? 'border-red-500' : ''}
                />
                {#if errors.password}
                    <p class="mt-1 text-sm text-red-600">{errors.password}</p>
                {/if}
            </div>
            
            <div>
                <Label for="confirmPassword" class="block mb-2">Confirm Password</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    bind:value={formData.confirmPassword}
                    oninput={(e) => setField('confirmPassword', (e.target as HTMLInputElement).value)}
                    class={errors.confirmPassword ? 'border-red-500' : ''}
                />
                {#if errors.confirmPassword}
                    <p class="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                {/if}
            </div>
            
            <div>
                <Label class="flex items-center">
                    <input
                        type="checkbox"
                        bind:checked={formData.isActive}
                        onchange={(e) => setField('isActive', (e.target as HTMLInputElement).checked)}
                        class="mr-2"
                    />
                    Active
                </Label>
            </div>
        </div>
        
        <div class="mt-6">
            <Label for="bio" class="block mb-2">Bio</Label>
            <Textarea
                id="bio"
                bind:value={formData.bio}
                oninput={(e) => setField('bio', (e.target as HTMLTextAreaElement).value)}
                rows={3}
            />
        </div>
        
        <div class="mt-8 flex justify-end">
            <Button
                type="submit"
                color="blue"
                disabled={isSubmitting}
            >
                <ShareAllOutline class="mr-2" />
                {isSubmitting ? 'Saving...' : (isEdit ? 'Update User' : 'Create User')}
            </Button>
        </div>
    </form>
</div>