import React, { useState } from "react";
import { BlockLabel, blockStyle } from "./MidArea";

export default function Sidebar({
  palette,
  activeCategory,
  onCategoryChange,
  makeBlock,
  onAddBlock,
}) {
  const [blocks, setBlocks] = useState(() =>
    Object.fromEntries(
      Object.values(palette)
        .flat()
        .map((type) => [type, makeBlock(type)]),
    ),
  );
  return (
    <aside className="palette-panel">
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
          <div
            key={type}
            className={`palette-block ${blockStyle[type]}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/block-type", type);
              event.dataTransfer.setData(
                "application/json",
                JSON.stringify(blocks[type]),
              );
            }}
            onClick={() => onAddBlock(type, [], blocks[type])}
            title="Click or drag into the script area"
          >
            <BlockLabel
              block={blocks[type]}
              update={(changes) =>
                setBlocks((current) => ({
                  ...current,
                  [type]: { ...current[type], ...changes },
                }))
              }
            />
            <span className="palette-add" aria-hidden="true">
              +
            </span>
          </div>
        ))}
      </div>
      <div className="palette-note">
        Click a block to add it, or drag it into a script.
      </div>
    </aside>
  );
}
