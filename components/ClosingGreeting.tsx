"use client";

import { useRef } from "react";
import LayeredCharacter, { type CharacterHandle } from "./LayeredCharacter";

export default function ClosingGreeting() {
  const lion = useRef<CharacterHandle>(null);
  const kitten = useRef<CharacterHandle>(null);
  const greet = () => {
    lion.current?.wave();
    kitten.current?.wave();
  };
  return (
    <button type="button" className="closing-greeting" onClick={greet}
      onPointerEnter={event => { if (event.pointerType === "mouse") greet(); }}
      aria-label="Привітатися з іменинниками ще раз">
      <span className="greeting-flowers" aria-hidden="true" />
      <LayeredCharacter ref={lion} kind="lion" className="greeting-character greeting-lion" autoWave />
      <LayeredCharacter ref={kitten} kind="kitten" className="greeting-character greeting-kitten" autoWave />
    </button>
  );
}
