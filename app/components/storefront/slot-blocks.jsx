/**
 * Renders plugin blocks for a named storefront slot.
 * Slot blocks are loaded server-side and passed via loader data.
 */
export default function SlotBlocks({ blocks = [] }) {
  if (!blocks.length) return null;

  return (
    <>
      {blocks.map(({ pluginId, component: Block }) => {
        if (!Block) return null;
        return <Block key={pluginId} />;
      })}
    </>
  );
}
