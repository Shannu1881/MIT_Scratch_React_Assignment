// Pointer-based drag & drop for blocks. Unlike the native HTML5 drag events it
// works the same with mouse, touch and pen, in every browser, and it does not
// fight with the <input> fields that live inside blocks.
//
// Drop zones are plain DOM elements tagged with data attributes:
//   data-drop="block"       data-block-id=…   drop before / after this block
//   data-drop="repeat-body" data-block-id=…   drop inside a Repeat block
//   data-drop="script-area"                   drop at the end of the script
//   data-drop="palette"                       (script blocks only) delete
//   data-drop="sprite"      data-sprite-id=…  (script blocks only) copy

const DRAG_THRESHOLD = 5;
let justDragged = false;

// A drag that just ended must not also count as a click on the block.
export function wasJustDragged() {
  return justDragged;
}

function isValidZone(kind, payload) {
  if (kind === "palette" || kind === "sprite") return payload.kind === "script";
  return true;
}

function findTarget(x, y, payload) {
  const hit = document.elementFromPoint(x, y);
  let zone = hit && hit.closest("[data-drop]");
  while (zone && !isValidZone(zone.dataset.drop, payload)) {
    zone = zone.parentElement && zone.parentElement.closest("[data-drop]");
  }
  if (!zone) return null;
  const kind = zone.dataset.drop;
  if (kind === "block") {
    // Use the block's own header so a Repeat block is split by its top bar,
    // not by the whole height of everything nested inside it.
    const head = zone.querySelector(":scope > .script-block-head") || zone;
    const bounds = head.getBoundingClientRect();
    const placement = y < bounds.top + bounds.height / 2 ? "before" : "after";
    return { kind, id: zone.dataset.blockId, placement, el: zone };
  }
  if (kind === "repeat-body") {
    return { kind, id: zone.dataset.blockId, el: zone };
  }
  if (kind === "sprite") {
    return { kind, spriteId: zone.dataset.spriteId, el: zone };
  }
  return { kind, el: zone };
}

const HIGHLIGHT_CLASSES = [
  "drop-before",
  "drop-after",
  "drop-inside",
  "drop-active",
];

function setHighlight(previous, target) {
  if (previous) previous.classList.remove(...HIGHLIGHT_CLASSES);
  if (!target) return null;
  const { el, kind, placement } = target;
  if (kind === "block") el.classList.add(`drop-${placement}`);
  else if (kind === "repeat-body") el.classList.add("drop-inside");
  else el.classList.add("drop-active");
  return el;
}

function buildGhost(source, rect) {
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.width = `${rect.width}px`;
  // Grabbing a script block also takes the blocks below it (like Scratch).
  let node = source;
  do {
    const copy = node.cloneNode(true);
    copy.classList.remove("drop-before", "drop-after", "drop-inside");
    ghost.appendChild(copy);
    node = node.classList.contains("script-block")
      ? node.nextElementSibling
      : null;
  } while (node && node.classList.contains("script-block"));
  document.body.appendChild(ghost);
  return ghost;
}

// Call from onPointerDown of a block.
//   payload: { kind: "palette", type, template } | { kind: "script", blockId }
//   onDrop(payload, target) runs when the block is released over a valid zone.
export function startBlockDrag(event, payload, onDrop) {
  if (event.button !== undefined && event.button !== 0) return;
  // Fields and buttons inside a block keep working normally.
  if (event.target.closest("input, button, textarea, select")) return;
  // Nested blocks: only the innermost block under the pointer starts a drag.
  event.stopPropagation();

  const source = event.currentTarget;
  const rect = source.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const pointerId = event.pointerId;
  let ghost = null;
  let highlighted = null;
  let target = null;
  const startX = event.clientX;
  const startY = event.clientY;

  function begin() {
    ghost = buildGhost(source, rect);
    source.classList.add("is-drag-source");
    document.body.classList.add("is-block-dragging");
  }

  function onMove(moveEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    if (!ghost) {
      const distance = Math.hypot(
        moveEvent.clientX - startX,
        moveEvent.clientY - startY,
      );
      if (distance < DRAG_THRESHOLD) return;
      begin();
    }
    moveEvent.preventDefault();
    ghost.style.transform = `translate(${moveEvent.clientX - offsetX}px, ${moveEvent.clientY - offsetY}px)`;
    target = findTarget(moveEvent.clientX, moveEvent.clientY, payload);
    highlighted = setHighlight(highlighted, target);
  }

  function finish(endEvent, cancelled) {
    if (endEvent.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    if (!ghost) return; // never moved far enough: it was a plain click
    ghost.remove();
    source.classList.remove("is-drag-source");
    document.body.classList.remove("is-block-dragging");
    setHighlight(highlighted, null);
    justDragged = true;
    window.setTimeout(() => {
      justDragged = false;
    }, 0);
    if (!cancelled && target) onDrop(payload, target);
  }

  const onUp = (upEvent) => finish(upEvent, false);
  const onCancel = (cancelEvent) => finish(cancelEvent, true);
  const onKey = (keyEvent) => {
    if (keyEvent.key === "Escape") finish({ pointerId }, true);
  };

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
}
