<script lang="ts">
  import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Dropdown, DropdownItem, DropdownDivider } from "flowbite-svelte";
  import { ChevronDownOutline } from "flowbite-svelte-icons";
  import { page } from "$app/state";
  import Logo from "$lib/Logo.svelte";
  let activeUrl = $derived(page.url.pathname);
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
    <NavLi class="cursor-pointer">
      Dropdown<ChevronDownOutline class="text-primary-800 ms-2 inline h-6 w-6 dark:text-white" />
    </NavLi>
    <Dropdown simple class="w-44">
      <DropdownItem href="/">Dashboard</DropdownItem>
      <DropdownItem href="/docs/components/navbar">Settings</DropdownItem>
      <DropdownItem href="/">Earnings</DropdownItem>
      <DropdownDivider />
      <DropdownItem href="/">Sign out</DropdownItem>
    </Dropdown>
    <NavLi href="/settings">Setting</NavLi>
    <NavLi href="/pricing">Pricing</NavLi>
    <NavLi href="/contact">Contact</NavLi>
  </NavUl>
</Navbar>