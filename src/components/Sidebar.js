import React, { useState } from "react";
import { BlockLabel, blockStyle } from "./MidArea";
import { startBlockDrag, wasJustDragged } from "../dragDrop";

function PaletteBlock({ type, block, onAddBlock, onBlockDrop, onChange }) {
  return (
    <div
      className={`palette-block ${blockStyle[type]}`}
      onPointerDown={(event) =>
        startBlockDrag(
          event,
          { kind: "palette", type, template: block },
          onBlockDrop,
        )
      }
      onClick={(event) => {
        if (wasJustDragged() || event.target.closest("input")) return;
        onAddBlock(type, [], block);
      }}
      title="Click or drag into the script area"
    >
      <BlockLabel block={block} update={onChange} />
      <span className="palette-add" aria-hidden="true">
        +
      </span>
    </div>
  );
}

export default function Sidebar({
  palette,
  activeCategory,
  onCategoryChange,
  makeBlock,
  onAddBlock,
  onBlockDrop,
}) {
  const [blocks, setBlocks] = useState(() =>
    Object.fromEntries(
      Object.values(palette)
        .flat()
        .map((type) => [type, makeBlock(type)]),
    ),
  );

  return (
    <aside className="palette-panel" data-drop="palette">
      <div className="panel-title">
        <span>BLOCKS</span>
        <span className="small-count">{palette[activeCategory].length}</span>
      </div>
      <nav className="category-tabs" aria-label="Block categories">
        {Object.keys(palette).map((category) => (
          <button
            key={category}
            type="button"
            className={`category-tab ${category.toLowerCase()} ${activeCategory === category ? "active" : ""}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      <p className="category-caption">{activeCategory} blocks</p>
      <div className="palette-blocks">
        {palette[activeCategory].map((type) => (
          <PaletteBlock
            key={type}
            type={type}
            block={blocks[type]}
            onAddBlock={onAddBlock}
            onBlockDrop={onBlockDrop}
            onChange={(changes) =>
              setBlocks((current) => ({
                ...current,
                [type]: { ...current[type], ...changes },
              }))
            }
          />
        ))}
      </div>
      <div className="palette-note">
        Click a block to add it, or drag it into a script. Drag a script block
        back here to delete it.
      </div>
    </aside>
  );
}
