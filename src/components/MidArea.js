import React, { useEffect, useRef } from "react";

export const blockStyle = {
  move: "motion",
  turn: "motion",
  goto: "motion",
  say: "looks",
  think: "looks",
  repeat: "control",
};

const blockNames = {
  move: "Move steps",
  turn: "Turn degrees",
  goto: "Go to x / y",
  say: "Say for seconds",
  think: "Think for seconds",
  repeat: "Repeat times",
};

function NumberInput({ label, width, value, update }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      aria-label={label}
      className={`block-input ${width}`}
      type="number"
      inputMode="decimal"
      defaultValue={value}
      onChange={(event) => update(event.target.value)}
      onBlur={(event) => {
        const number = Number(event.target.value);
        const normalized = Number.isFinite(number) ? number : 0;
        event.target.value = normalized;
        update(normalized);
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function BlockLabel({ block, update }) {
  const numberInput = (field, value, width = "small") => (
    <NumberInput
      label={`${blockNames[block.type]} ${field}`}
      width={width}
      value={value}
      update={(draft) => update({ [field]: draft })}
    />
  );

  if (block.type === "move")
    return <>Move {numberInput("steps", block.steps)} steps</>;
  if (block.type === "turn")
    return <>Turn {numberInput("degrees", block.degrees)} degrees</>;
  if (block.type === "goto")
    return (
      <>
        Go to x {numberInput("x", block.x)} y {numberInput("y", block.y)}
      </>
    );
  if (block.type === "say" || block.type === "think") {
    return (
      <>
        {block.type === "say" ? "Say" : "Think"}{" "}
        <input
          aria-label="Speech text"
          className="block-input text-input"
          value={block.text}
          onChange={(event) => update({ text: event.target.value })}
          onClick={(event) => event.stopPropagation()}
        />{" "}
        for {numberInput("seconds", block.seconds)} sec
      </>
    );
  }
  return <>Repeat {numberInput("times", block.times)} times</>;
}

function ScriptBlock({ block, path, onUpdate, onRemove, onDrop }) {
  return (
    <div className={`script-block ${blockStyle[block.type]}`}>
      <div className="script-block-head">
        <span>
          <BlockLabel
            block={block}
            update={(changes) => onUpdate(path, changes)}
          />
        </span>
        <button
          className="remove-block"
          type="button"
          aria-label="Remove block"
          title="Remove block"
          onClick={() => onRemove(path)}
        >
          ×
        </button>
      </div>
      {block.type === "repeat" && (
        <div
          className="repeat-contents"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, path)}
        >
          {block.children.map((child, index) => (
            <ScriptBlock
              key={child.id}
              block={child}
              path={[...path, index]}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onDrop={onDrop}
            />
          ))}
          {block.children.length === 0 && (
            <span className="drop-hint">Drop blocks here</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function MidArea({
  sprite,
  onUpdate,
  onRemove,
  onDrop,
  onAddBlock,
}) {
  return (
    <section className="scripts-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SCRIPT EDITOR</span>
          <h1>{sprite?.name || "Sprite"}</h1>
        </div>
        <span className="script-count">
          {sprite?.scripts.length || 0} blocks
        </span>
      </div>
      <div
        className="scripts-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(event)}
      >
        {sprite?.scripts.length ? (
          sprite.scripts.map((block, index) => (
            <ScriptBlock
              key={block.id}
              block={block}
              path={[index]}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onDrop={onDrop}
            />
          ))
        ) : (
          <div className="empty-scripts">
            <strong>Your script is empty</strong>
            <span>Drag in a block or click one from the palette.</span>
          </div>
        )}
        <button
          type="button"
          className="add-script-block"
          onClick={() => onAddBlock("move")}
        >
          + Add a motion block
        </button>
      </div>
      <div className="script-footer">
        <span>Scripts are saved per sprite</span>
        <span>Drop inside Repeat to nest</span>
      </div>
    </section>
  );
}
