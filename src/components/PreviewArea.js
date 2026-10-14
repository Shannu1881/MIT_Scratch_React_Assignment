import React from "react";
import CatSprite from "./CatSprite";
import Icon from "./Icon";

export default function PreviewArea({
  sprites,
  selectedSpriteId,
  onSelectSprite,
  onAddSprite,
  collisionCount,
}) {
  return (
    <section className="stage-panel">
      <div className="stage-heading">
        <div>
          <span className="eyebrow">PLAYGROUND</span>
          <h2>Stage</h2>
        </div>
        <div className="stage-size">480 × 300</div>
      </div>
      <div className="stage" role="img" aria-label="Sprite playground">
        <div className="stage-crosshair vertical" />
        <div className="stage-crosshair horizontal" />
        {sprites.map((sprite) => (
          <div
            key={sprite.id}
            className="stage-sprite"
            style={{
              transform: `translate(calc(-50% + ${sprite.x}px), calc(-50% - ${sprite.y}px))`,
            }}
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
        <div className="stage-coordinate">x 0 &nbsp; y 0</div>
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
        {sprites.map((sprite) => (
          <button
            key={sprite.id}
            type="button"
            className={`sprite-row ${selectedSpriteId === sprite.id ? "selected" : ""}`}
            onClick={() => onSelectSprite(sprite.id)}
          >
            <span className={`sprite-thumb ${sprite.tint}`}>
              <CatSprite />
            </span>
            <span className="sprite-row-name">{sprite.name}</span>
            <span className="sprite-position">
              {Math.round(sprite.x)}, {Math.round(sprite.y)}
            </span>
          </button>
        ))}
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
