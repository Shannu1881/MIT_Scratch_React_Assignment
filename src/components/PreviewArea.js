import React, { useLayoutEffect, useRef, useState } from "react";
import CatSprite from "./CatSprite";
import Icon from "./Icon";

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;

export default function PreviewArea({
  sprites,
  selectedSpriteId,
  onSelectSprite,
  onMoveSprite,
  onAddSprite,
  scriptSource,
  collisionCount,
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  // One uniform scale (stage px per stage unit) keeps x and y in proportion,
  // so "move 10 steps" is the same distance on screen in every direction.
  const [stageScale, setStageScale] = useState(1);
  const [draggingSpriteId, setDraggingSpriteId] = useState(null);
  const selectedSprite = sprites.find((sprite) => sprite.id === selectedSpriteId);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const updateScale = () => {
      if (stage.clientWidth > 0) setStageScale(stage.clientWidth / STAGE_WIDTH);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  function startSpriteDrag(event, sprite) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      spriteId: sprite.id,
      startX: event.clientX,
      startY: event.clientY,
      spriteX: sprite.x,
      spriteY: sprite.y,
    };
    setDraggingSpriteId(sprite.id);
    onSelectSprite(sprite.id);
  }

  function moveSpriteDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onMoveSprite(
      drag.spriteId,
      drag.spriteX + (event.clientX - drag.startX) / stageScale,
      drag.spriteY - (event.clientY - drag.startY) / stageScale,
    );
  }

  function stopSpriteDrag(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingSpriteId(null);
  }

  return (
    <section className="stage-panel">
      <div className="stage-heading">
        <div>
          <span className="eyebrow">PLAYGROUND</span>
          <h2>Stage</h2>
        </div>
        <div className="stage-size">480 × 360</div>
      </div>
      <div
        className="stage"
        ref={stageRef}
        role="group"
        aria-label="Sprite playground"
        style={{ height: STAGE_HEIGHT * stageScale }}
      >
        <div className="stage-crosshair vertical" />
        <div className="stage-crosshair horizontal" />
        {sprites.map((sprite) => (
          <div
            key={sprite.id}
            className={`stage-sprite ${draggingSpriteId === sprite.id ? "is-dragging" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${sprite.x * stageScale}px), calc(-50% - ${sprite.y * stageScale}px))`,
            }}
            onPointerDown={(event) => startSpriteDrag(event, sprite)}
            onPointerMove={moveSpriteDrag}
            onPointerUp={stopSpriteDrag}
            onPointerCancel={stopSpriteDrag}
            aria-label={`${sprite.name}, x ${Math.round(sprite.x)}, y ${Math.round(sprite.y)}`}
          >
            {sprite.bubble && (
              <div className={`speech-bubble ${sprite.bubble.type}`}>
                {sprite.bubble.text}
              </div>
            )}
            <div
              className={`stage-cat ${sprite.tint}`}
              style={{ transform: `rotate(${sprite.direction - 90}deg)` }}
            >
              <CatSprite />
            </div>
            <span className="stage-sprite-name">{sprite.name}</span>
          </div>
        ))}
        <div className="stage-coordinate">
          x {Math.round(selectedSprite?.x || 0)} &nbsp; y {Math.round(selectedSprite?.y || 0)}
        </div>
      </div>
      <div className="sprite-list-heading">
        <h3>Sprites</h3>
        <span>{sprites.length}</span>
        <button
          type="button"
          aria-label="Add sprite"
          title="Add sprite"
          onClick={onAddSprite}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="sprite-list">
        {sprites.map((sprite) => {
          const sourceId = scriptSource[sprite.id];
          const source =
            sourceId && sourceId !== sprite.id
              ? sprites.find((item) => item.id === sourceId)
              : null;
          return (
            <button
              key={sprite.id}
              type="button"
              className={`sprite-row ${selectedSpriteId === sprite.id ? "selected" : ""}`}
              data-drop="sprite"
              data-sprite-id={sprite.id}
              onClick={() => onSelectSprite(sprite.id)}
            >
              <span className={`sprite-thumb ${sprite.tint}`}>
                <CatSprite />
              </span>
              <span className="sprite-row-name">{sprite.name}</span>
              {source && (
                <span className="sprite-swap-tag">
                  ⇄ running {source.name}'s script
                </span>
              )}
              <span className="sprite-position">
                {Math.round(sprite.x)}, {Math.round(sprite.y)}
              </span>
            </button>
          );
        })}
      </div>
      <div className={`collision-status ${collisionCount ? "detected" : ""}`}>
        <span className="collision-dot" />
        {collisionCount
          ? `Collision detected · motion swapped (${collisionCount})`
          : "Collision swap ready"}
      </div>
    </section>
  );
}
