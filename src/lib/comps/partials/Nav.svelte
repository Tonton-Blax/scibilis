<script lang="ts">
  import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Dropdown, DropdownItem, DropdownDivider } from "flowbite-svelte";
  import { ChevronDownOutline } from "flowbite-svelte-icons";
  import { page } from "$app/state";
  import Logo from "$lib/Logo.svelte";
  import { goto } from "$app/navigation";
  
  let activeUrl = $derived(page.url.pathname);
  
  // Get user data from page data
  let user = $state(page.data?.user || null);
  
  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      });
      
      if (response.ok) {
        // Redirect to login page
        await goto('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
</script>

<Navbar navContainerClass="max-w-none !px-0">
  <NavBrand href="/">
    <Logo />
    <span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">
      Scibilis
    </span>
  </NavBrand>
  <NavHamburger />
  <NavUl {activeUrl}>
    <NavLi href="/">Home</NavLi>
    {#if user}
      <NavLi href="/profile">Profile</NavLi>
      {#if user.role === 'admin'}
        <NavLi href="/users">Users</NavLi>
      {/if}
      <NavLi class="cursor-pointer">
        Dropdown<ChevronDownOutline class="text-primary-800 ms-2 inline h-6 w-6 dark:text-white" />
      </NavLi>
      <Dropdown simple class="w-44">
        <DropdownItem href="/profile">Profile</DropdownItem>
        {#if user.role === 'admin'}
          <DropdownItem href="/users">Manage Users</DropdownItem>
        {/if}
        <DropdownDivider />
        <DropdownItem href="/logout">Sign out</DropdownItem>
      </Dropdown>
    {:else}
      <NavLi href="/login">Login</NavLi>
    {/if}
  </NavUl>
</Navbar>