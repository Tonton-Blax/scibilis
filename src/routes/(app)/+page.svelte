<script lang="ts">
	import PlusPlaceholder from '$lib/comps/misc/PlusPlaceholder.svelte';
	import DropZone from '$lib/comps/ui/DropZone.svelte';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
</script>

<div class="overflow-auto px-4 md:ml-64">
    <div class="rounded-lg border-2 border-dashed border-gray-200 p-4 dark:border-gray-700">
      <PlusPlaceholder colnum={1} rownum={1}>
        <DropZone />    
      </PlusPlaceholder>
      <!-- <PlusPlaceholder />
      <PlusPlaceholder colnum={2} rownum={2} />
      <PlusPlaceholder />
      <PlusPlaceholder colnum={2} rownum={2} /> -->
    </div>
  </div>