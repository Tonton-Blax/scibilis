<script lang="ts">
	import Drawer from '$lib/comps/partials/Drawer.svelte';
	import Footer from '$lib/comps/partials/Footer.svelte';
	import Nav from '$lib/comps/partials/Nav.svelte';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
</script>
<div class="pb-8 px-4 mx-auto lg:pb-16 lg:px-6 pt-4">

<Nav />
<div class="relative">
<Drawer />
{@render children()}
</div>
<Footer />
</div>
