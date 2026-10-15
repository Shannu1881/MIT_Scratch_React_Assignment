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

// Same coordinate system as Scratch: x -240..240, y -180..180.
const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;
// Two sprites collide when their centres are closer than this (stage units).
const COLLISION_DISTANCE = 76;
const MAX_REPEAT = 1000;

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

// A fresh block of `type`, optionally pre-filled from a palette template.
function buildBlock(type, template = {}) {
  const base = makeBlock(type);
  return { ...base, ...template, id: base.id, type };
}

// Deep copy of a list of blocks with brand-new ids.
function cloneBlocks(blocks) {
  return blocks.map((block) => ({
    ...block,
    id: `block-${nextBlockId++}`,
    ...(block.children ? { children: cloneBlocks(block.children) } : {}),
  }));
}

function makeSprite(id, name, x, y, steps, tint) {
  return {
    id,
    name,
    x,
    y,
    direction: 90,
    tint,
    bubble: null,
    // Where the sprite starts every time Play is pressed.
    home: { x, y, direction: 90 },
    scripts: [
      { ...makeBlock("move"), steps },
      {
        ...makeBlock("repeat"),
        times: 18,
        children: [{ ...makeBlock("move"), steps }],
      },
    ],
  };
}

// New sprites are placed in these slots in order, so they never land in
// random places or on top of each other. Left-hand slots walk right and
// right-hand slots walk left, so every row of two sprites meets in the middle.
const SPRITE_SLOTS = [
  { x: -105, y: 0, steps: 10 },
  { x: 105, y: 0, steps: -10 },
  { x: -105, y: 105, steps: 10 },
  { x: 105, y: 105, steps: -10 },
  { x: -105, y: -105, steps: 10 },
  { x: 105, y: -105, steps: -10 },
];
const SPRITE_TINTS = ["", "sprite-tint-blue", "sprite-tint-pink"];

function makeSpriteInSlot(id, name, slot, tint) {
  return makeSprite(id, name, slot.x, slot.y, slot.steps, tint);
}

const initialSprites = [
  makeSpriteInSlot("sprite-1", "Pico", SPRITE_SLOTS[0], SPRITE_TINTS[0]),
  makeSpriteInSlot("sprite-2", "Tera", SPRITE_SLOTS[1], SPRITE_TINTS[1]),
];

// First slot that is not already taken by a sprite.
function findFreeSlot(sprites) {
  return SPRITE_SLOTS.find((slot) =>
    sprites.every(
      (sprite) =>
        Math.hypot(sprite.home.x - slot.x, sprite.home.y - slot.y) >=
        COLLISION_DISTANCE,
    ),
  );
}

// Fallback once every slot is used: a random spot clear of the others.
function findFreeSpot(sprites) {
  let spot = { x: 0, y: 0 };
  for (let attempt = 0; attempt < 80; attempt += 1) {
    spot = {
      x: Math.round((Math.random() * 2 - 1) * 170),
      y: Math.round((Math.random() * 2 - 1) * 110),
    };
    const isFree = sprites.every(
      (sprite) =>
        Math.hypot(sprite.home.x - spot.x, sprite.home.y - spot.y) >=
        COLLISION_DISTANCE + 24,
    );
    if (isFree) return spot;
  }
  return spot;
}

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

function findBlockPath(blocks, blockId, parentPath = []) {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const path = [...parentPath, index];
    if (block.id === blockId) return path;
    const childPath = findBlockPath(block.children || [], blockId, path);
    if (childPath) return childPath;
  }
  return null;
}

function containsId(blocks, blockId) {
  return blocks.some(
    (block) =>
      block.id === blockId || containsId(block.children || [], blockId),
  );
}

// Insert a list of blocks before / after / inside the block with `targetId`.
function insertBlocksRelative(blocks, targetId, newBlocks, placement) {
  return blocks.flatMap((current) => {
    if (current.id === targetId) {
      if (placement === "inside" && current.type === "repeat") {
        return [
          {
            ...current,
            children: [...(current.children || []), ...newBlocks],
          },
        ];
      }
      return placement === "before"
        ? [...newBlocks, current]
        : [current, ...newBlocks];
    }
    if (!current.children) return [current];
    return [
      {
        ...current,
        children: insertBlocksRelative(
          current.children,
          targetId,
          newBlocks,
          placement,
        ),
      },
    ];
  });
}

// Like Scratch: grabbing a block takes it and every block below it
// (in the same stack) along with it.
function takeStack(blocks, path) {
  const [index, ...rest] = path;
  if (rest.length === 0) {
    return { stack: blocks.slice(index), remaining: blocks.slice(0, index) };
  }
  const inner = takeStack(blocks[index].children || [], rest);
  return {
    stack: inner.stack,
    remaining: blocks.map((block, blockIndex) =>
      blockIndex === index ? { ...block, children: inner.remaining } : block,
    ),
  };
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

function getOverlappingPairs(sprites) {
  const pairs = [];
  for (let first = 0; first < sprites.length; first += 1) {
    for (let second = first + 1; second < sprites.length; second += 1) {
      const a = sprites[first];
      const b = sprites[second];
      if (Math.hypot(a.x - b.x, a.y - b.y) < COLLISION_DISTANCE) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}

export default function App() {
  const [sprites, setSprites] = useState(initialSprites);
  const [selectedSpriteId, setSelectedSpriteId] = useState("sprite-1");
  const [activeCategory, setActiveCategory] = useState("Motion");
  const [isRunning, setIsRunning] = useState(false);
  const [collisionCount, setCollisionCount] = useState(0);
  // spriteId -> id of the sprite whose script it is currently running.
  // Collisions swap these entries; the scripts themselves are never edited,
  // so every Run starts from exactly what is shown in the editor.
  const [scriptSource, setScriptSource] = useState({});
  const spritesRef = useRef(sprites);
  const scriptSourceRef = useRef({});
  const overlappingRef = useRef(new Set());
  const isRunningRef = useRef(false);
  const runToken = useRef(0);
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
    const block = buildBlock(type, template);
    updateSprite(selectedSpriteId, (sprite) => ({
      ...sprite,
      scripts: appendBlock(sprite.scripts, destination, block),
    }));
  }

  // Called by the pointer drag system (see dragDrop.js) when a block is
  // released. `payload` says what was dragged (a palette template or an
  // existing script block); `target` says where it was dropped.
  function onBlockDrop(payload, target) {
    if (payload.kind === "palette") {
      const block = buildBlock(payload.type, payload.template);
      updateSprite(selectedSpriteId, (sprite) => {
        if (target.kind === "script-area") {
          return { ...sprite, scripts: [...sprite.scripts, block] };
        }
        if (target.kind !== "block" && target.kind !== "repeat-body") {
          return sprite;
        }
        const placement =
          target.kind === "repeat-body" ? "inside" : target.placement;
        return {
          ...sprite,
          scripts: insertBlocksRelative(
            sprite.scripts,
            target.id,
            [block],
            placement,
          ),
        };
      });
      return;
    }

    const blockId = payload.blockId;
    const source = spritesRef.current.find(
      (sprite) => sprite.id === selectedSpriteId,
    );
    const sourcePath = source && findBlockPath(source.scripts, blockId);
    if (!sourcePath) return;
    const { stack, remaining } = takeStack(source.scripts, sourcePath);

    if (target.kind === "palette") {
      // Dropping a script block onto the palette deletes it (like Scratch).
      updateSprite(selectedSpriteId, (sprite) => ({
        ...sprite,
        scripts: remaining,
      }));
    } else if (target.kind === "sprite") {
      // Dropping onto a sprite in the sprite list copies the stack there.
      if (target.spriteId === selectedSpriteId) return;
      updateSprite(target.spriteId, (sprite) => ({
        ...sprite,
        scripts: [...sprite.scripts, ...cloneBlocks(stack)],
      }));
    } else if (target.kind === "script-area") {
      updateSprite(selectedSpriteId, (sprite) => ({
        ...sprite,
        scripts: [...remaining, ...stack],
      }));
    } else {
      // Can't drop a stack onto itself or into one of its own repeat blocks.
      if (containsId(stack, target.id)) return;
      const placement =
        target.kind === "repeat-body" ? "inside" : target.placement;
      updateSprite(selectedSpriteId, (sprite) => ({
        ...sprite,
        scripts: insertBlocksRelative(remaining, target.id, stack, placement),
      }));
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
    updateSprite(selectedSpriteId, (sprite) => ({
      ...sprite,
      scripts: removeAtPath(sprite.scripts, path),
    }));
  }

  function addSprite() {
    const id = `sprite-${nextSpriteId++}`;
    const current = spritesRef.current;
    const slot = findFreeSlot(current) || {
      ...findFreeSpot(current),
      steps: 10,
    };
    const newSprite = makeSpriteInSlot(
      id,
      `Sprite ${nextSpriteId - 1}`,
      slot,
      SPRITE_TINTS[current.length % SPRITE_TINTS.length],
    );
    commitSprites([...current, newSprite]);
    setSelectedSpriteId(id);
  }

  // Hero feature: when two sprites newly touch, they swap animations.
  function checkCollision() {
    if (!isRunningRef.current) return;
    const pairs = getOverlappingPairs(spritesRef.current);
    const keys = new Set(pairs.map((pair) => pair.join("|")));
    const fresh = pairs.filter(
      (pair) => !overlappingRef.current.has(pair.join("|")),
    );
    overlappingRef.current = keys;
    if (fresh.length === 0) return;

    const next = { ...scriptSourceRef.current };
    fresh.forEach(([a, b]) => {
      const sourceA = next[a] || a;
      const sourceB = next[b] || b;
      next[a] = sourceB;
      next[b] = sourceA;
    });
    scriptSourceRef.current = next;
    setScriptSource(next);
    setCollisionCount((count) => count + fresh.length);
  }

  function moveSprite(spriteId, x, y) {
    const nextX = Math.max(-STAGE_WIDTH / 2, Math.min(STAGE_WIDTH / 2, x));
    const nextY = Math.max(-STAGE_HEIGHT / 2, Math.min(STAGE_HEIGHT / 2, y));
    const idle = !isRunningRef.current;
    updateSprite(spriteId, (sprite) => ({
      ...sprite,
      x: nextX,
      y: nextY,
      // Dragging a sprite while idle sets where it starts the next run.
      ...(idle
        ? { home: { x: nextX, y: nextY, direction: sprite.home.direction } }
        : {}),
    }));
    checkCollision();
  }

  async function wait(milliseconds, token) {
    await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    return runToken.current === token;
  }

  // The script a sprite is currently running (its own, or a swapped one).
  function getScripts(spriteId) {
    const sourceId = scriptSourceRef.current[spriteId] || spriteId;
    const source = spritesRef.current.find((sprite) => sprite.id === sourceId);
    return source ? source.scripts : [];
  }

  async function executeSequence(spriteId, parentPath, token) {
    // The script is re-read on every step so a swap takes effect immediately.
    for (let index = 0; ; index += 1) {
      if (runToken.current !== token) return;
      const blocks = getBlocksAtPath(getScripts(spriteId), parentPath);
      if (index >= blocks.length) return;
      const block = blocks[index];
      const path = [...parentPath, index];
      const sprite = spritesRef.current.find((item) => item.id === spriteId);
      if (!sprite) return;

      if (block.type === "move") {
        const distance = Number(block.steps || 0);
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
        const repeatCount = Math.max(
          0,
          Math.min(MAX_REPEAT, Math.floor(Number(block.times) || 0)),
        );
        for (let iteration = 0; iteration < repeatCount; iteration += 1) {
          if (!(await wait(0, token))) return;
          await executeSequence(spriteId, path, token);
        }
      }
    }
  }

  async function runAll() {
    if (isRunningRef.current) return;
    const token = runToken.current + 1;
    runToken.current = token;

    // Every run starts from the same place with the scripts as written.
    const startState = spritesRef.current.map((sprite) => ({
      ...sprite,
      x: sprite.home.x,
      y: sprite.home.y,
      direction: sprite.home.direction,
      bubble: null,
    }));
    commitSprites(startState);
    scriptSourceRef.current = {};
    setScriptSource({});
    // Sprites that already overlap at the start must separate and touch
    // again before they swap.
    overlappingRef.current = new Set(
      getOverlappingPairs(startState).map((pair) => pair.join("|")),
    );
    setCollisionCount(0);
    isRunningRef.current = true;
    setIsRunning(true);

    await Promise.all(
      startState.map((sprite) => executeSequence(sprite.id, [], token)),
    );
    if (runToken.current === token) {
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }

  function stopAll() {
    runToken.current += 1;
    isRunningRef.current = false;
    setIsRunning(false);
    scriptSourceRef.current = {};
    setScriptSource({});
    commitSprites(
      spritesRef.current.map((sprite) => ({ ...sprite, bubble: null })),
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
            ▶ Play
          </button>
          <button
            className="stop-button"
            type="button"
            onClick={stopAll}
            disabled={!isRunning}
          >
            ■ Stop
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
          onBlockDrop={onBlockDrop}
        />
        <MidArea
          sprite={selectedSprite}
          onUpdate={updateBlock}
          onRemove={removeBlock}
          onBlockDrop={onBlockDrop}
          onAddBlock={addBlock}
        />
        <PreviewArea
          sprites={sprites}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={setSelectedSpriteId}
          onMoveSprite={moveSprite}
          onAddSprite={addSprite}
          scriptSource={scriptSource}
          collisionCount={collisionCount}
        />
      </div>
    </main>
  );
}
