/**
 * Renders plugin blocks for a named slot.
 * Slot blocks are loaded server-side and passed via loader data.
 */
export default function SlotBlocks({ blocks = [], slotProps = {} }) {
  if (!blocks.length) return null;

  return (
    <>
      {blocks.map(({ pluginId, component: Block }) => {
        if (!Block) return null;
        return <Block key={pluginId} {...slotProps} />;
      })}
    </>
  );
}
