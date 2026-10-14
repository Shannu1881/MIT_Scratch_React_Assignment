import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import MidArea from "./components/MidArea";
import PreviewArea from "./components/PreviewArea";

const palette = {
  Motion: ["move", "turn", "goto"],
  Looks: ["say", "think"],
  Control: ["repeat"],
};

let nextBlockId = 0;
let nextSpriteId = 3;

function makeBlock(type) {
  const block = { id: `block-${nextBlockId++}`, type };
  if (type === "move") block.steps = 10;
  if (type === "turn") block.degrees = 15;
  if (type === "goto") Object.assign(block, { x: 0, y: 0 });
  if (type === "say" || type === "think") {
    Object.assign(block, { text: "Hello!", seconds: 2 });
  }
  if (type === "repeat") Object.assign(block, { times: 10, children: [] });
  return block;
}

function makeSprite(id, name, x, steps, tint) {
  return {
    id,
    name,
    x,
    y: 0,
    direction: 90,
    tint,
    bubble: null,
    scripts: [
      makeBlock("move"),
      {
        ...makeBlock("repeat"),
        times: 18,
        children: [{ ...makeBlock("move"), steps }],
      },
    ].map((block, index) => {
      if (index === 0 && block.type === "move") return { ...block, steps };
      return block;
    }),
  };
}

const initialSprites = [
  makeSprite("sprite-1", "Pico", -105, 10, ""),
  makeSprite("sprite-2", "Tera", 105, -10, "sprite-tint-blue"),
];

function patchBlock(blocks, path, updater) {
  if (path.length === 0) return blocks;
  const [index, ...rest] = path;
  return blocks.map((block, blockIndex) => {
    if (blockIndex !== index) return block;
    if (rest.length === 0) return updater(block);
    return {
      ...block,
      children: patchBlock(block.children || [], rest, updater),
    };
  });
}

function appendBlock(blocks, path, block) {
  if (path.length === 0) return [...blocks, block];
  const [index, ...rest] = path;
  return blocks.map((current, blockIndex) => {
    if (blockIndex !== index) return current;
    return {
      ...current,
      children: appendBlock(current.children || [], rest, block),
    };
  });
}

function swapMoveBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "move")
      return { ...block, steps: -Number(block.steps || 0) };
    if (block.children)
      return { ...block, children: swapMoveBlocks(block.children) };
    return block;
  });
}

function getBlockAtPath(blocks, path) {
  let current = blocks;
  let block = null;
  for (const index of path) {
    block = current[index];
    if (!block) return null;
    current = block.children || [];
  }
  return block;
}

export default function App() {
  const [sprites, setSprites] = useState(initialSprites);
  const [selectedSpriteId, setSelectedSpriteId] = useState("sprite-1");
  const [activeCategory, setActiveCategory] = useState("Motion");
  const [isRunning, setIsRunning] = useState(false);
  const [collisionCount, setCollisionCount] = useState(0);
  const spritesRef = useRef(sprites);
  const runToken = useRef(0);
  const collisionReady = useRef(true);
  const selectedSprite =
    sprites.find((sprite) => sprite.id === selectedSpriteId) || sprites[0];

  useEffect(() => {
    spritesRef.current = sprites;
  }, [sprites]);

  useEffect(
    () => () => {
      runToken.current += 1;
    },
    [],
  );

  function commitSprites(nextSprites) {
    spritesRef.current = nextSprites;
    setSprites(nextSprites);
  }

  function updateSprite(spriteId, updater) {
    commitSprites(
      spritesRef.current.map((sprite) =>
        sprite.id === spriteId ? updater(sprite) : sprite,
      ),
    );
  }

  function addBlock(type, destination = [], template = {}) {
    const block = makeBlock(type);
    updateSprite(selectedSpriteId, (sprite) => ({
      ...sprite,
      scripts: appendBlock(sprite.scripts, destination, {
        ...block,
        ...template,
        id: block.id,
        type,
      }),
    }));
  }

  function onPaletteDrop(event, destination = []) {
    event.preventDefault();
    event.stopPropagation();
    const type = event.dataTransfer.getData("text/block-type");
    if (
      palette.Motion.includes(type) ||
      palette.Looks.includes(type) ||
      palette.Control.includes(type)
    ) {
      let template = {};
      try {
        template = JSON.parse(
          event.dataTransfer.getData("application/json") || "{}",
        );
      } catch {
        template = {};
      }
      addBlock(type, destination, template);
    }
  }

  function updateBlock(path, changes) {
    updateSprite(selectedSpriteId, (sprite) => ({
      ...sprite,
      scripts: patchBlock(sprite.scripts, path, (block) => ({
        ...block,
        ...changes,
      })),
    }));
  }

  function removeBlock(path) {
    const [index, ...parentPath] = path;
    updateSprite(selectedSpriteId, (sprite) => ({
      ...sprite,
      scripts: patchBlock(sprite.scripts, parentPath, (parent) => {
        if (parentPath.length === 0) return parent;
        const children = [...(parent.children || [])];
        children.splice(index, 1);
        return { ...parent, children };
      }),
      ...(parentPath.length === 0
        ? { scripts: removeAtPath(sprite.scripts, path) }
        : {}),
    }));
  }

  function addSprite() {
    const id = `sprite-${nextSpriteId++}`;
    const newSprite = makeSprite(
      id,
      `Sprite ${nextSpriteId - 1}`,
      0,
      10,
      "sprite-tint-pink",
    );
    commitSprites([...spritesRef.current, newSprite]);
    setSelectedSpriteId(id);
  }

  function checkCollision() {
    const current = spritesRef.current;
    if (current.length < 2) return;
    let collidedPair = null;
    for (
      let firstIndex = 0;
      firstIndex < current.length && !collidedPair;
      firstIndex += 1
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < current.length;
        secondIndex += 1
      ) {
        const first = current[firstIndex];
        const second = current[secondIndex];
        if (Math.hypot(first.x - second.x, first.y - second.y) < 76) {
          collidedPair = [first.id, second.id];
          break;
        }
      }
    }
    if (!collidedPair) {
      collisionReady.current = true;
      return;
    }
    if (!collisionReady.current) return;
    collisionReady.current = false;
    commitSprites(
      current.map((sprite) =>
        collidedPair.includes(sprite.id)
          ? { ...sprite, scripts: swapMoveBlocks(sprite.scripts) }
          : sprite,
      ),
    );
    setCollisionCount((count) => count + 1);
  }

  function moveSprite(spriteId, x, y) {
    updateSprite(spriteId, (sprite) => ({
      ...sprite,
      x: Math.max(-210, Math.min(210, x)),
      y: Math.max(-125, Math.min(125, y)),
    }));
    checkCollision();
  }

  async function wait(milliseconds, token) {
    await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    return runToken.current === token;
  }

  async function executeSequence(spriteId, parentPath, token) {
    const initial = spritesRef.current.find((sprite) => sprite.id === spriteId);
    const blockCount = getBlocksAtPath(
      initial?.scripts || [],
      parentPath,
    ).length;
    for (let index = 0; index < blockCount; index += 1) {
      if (runToken.current !== token) return;
      const path = [...parentPath, index];
      const sprite = spritesRef.current.find((item) => item.id === spriteId);
      const block = sprite && getBlockAtPath(sprite.scripts, path);
      if (!block) continue;
      if (block.type === "move") {
        const distance = Number(block.steps || 0) * 3;
        const radians = (sprite.direction * Math.PI) / 180;
        moveSprite(
          spriteId,
          sprite.x + Math.sin(radians) * distance,
          sprite.y + Math.cos(radians) * distance,
        );
        if (!(await wait(220, token))) return;
      } else if (block.type === "turn") {
        updateSprite(spriteId, (current) => ({
          ...current,
          direction: current.direction + Number(block.degrees || 0),
        }));
      } else if (block.type === "goto") {
        moveSprite(spriteId, Number(block.x || 0), Number(block.y || 0));
        if (!(await wait(220, token))) return;
      } else if (block.type === "say" || block.type === "think") {
        updateSprite(spriteId, (current) => ({
          ...current,
          bubble: { type: block.type, text: block.text },
        }));
        if (
          !(await wait(Math.max(0.2, Number(block.seconds) || 0) * 1000, token))
        )
          return;
        updateSprite(spriteId, (current) => ({ ...current, bubble: null }));
      } else if (block.type === "repeat") {
        const repeatCount = Math.max(0, Math.min(50, Number(block.times) || 0));
        for (let iteration = 0; iteration < repeatCount; iteration += 1) {
          if (!(await wait(0, token))) return;
          await executeSequence(spriteId, path, token);
        }
      }
    }
  }

  async function runAll() {
    const token = runToken.current + 1;
    runToken.current = token;
    collisionReady.current = true;
    setCollisionCount(0);
    setIsRunning(true);
    await Promise.all(
      spritesRef.current.map((sprite) => executeSequence(sprite.id, [], token)),
    );
    if (runToken.current === token) setIsRunning(false);
  }

  function stopAll() {
    runToken.current += 1;
    setIsRunning(false);
    spritesRef.current.forEach((sprite) =>
      updateSprite(sprite.id, (current) => ({ ...current, bubble: null })),
    );
  }

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div className="project-name">
          <strong>Scratch Studio</strong>
          <span>Untitled project</span>
        </div>
        <div className="topbar-actions">
          <button className="topbar-button" type="button" onClick={addSprite}>
            + Add sprite
          </button>
          <button
            className="run-button"
            type="button"
            onClick={runAll}
            disabled={isRunning}
          >
            Run all
          </button>
          <button
            className="stop-button"
            type="button"
            onClick={stopAll}
            disabled={!isRunning}
          >
            Stop
          </button>
        </div>
      </header>

      <div className="workspace">
        <Sidebar
          palette={palette}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          makeBlock={makeBlock}
          onAddBlock={addBlock}
        />
        <MidArea
          sprite={selectedSprite}
          onUpdate={updateBlock}
          onRemove={removeBlock}
          onDrop={onPaletteDrop}
          onAddBlock={addBlock}
        />
        <PreviewArea
          sprites={sprites}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={setSelectedSpriteId}
          onAddSprite={addSprite}
          collisionCount={collisionCount}
        />
      </div>
    </main>
  );
}

function removeAtPath(blocks, path) {
  const [index, ...rest] = path;
  if (rest.length === 0)
    return blocks.filter((_, blockIndex) => blockIndex !== index);
  return blocks.map((block, blockIndex) =>
    blockIndex === index
      ? { ...block, children: removeAtPath(block.children || [], rest) }
      : block,
  );
}

function getBlocksAtPath(blocks, path) {
  if (path.length === 0) return blocks;
  const [index, ...rest] = path;
  return getBlocksAtPath(blocks[index]?.children || [], rest);
}
