import SeatedCharacter from "./SeatedCharacter";

export default function ClosingGreeting() {
  return (
    <div className="closing-greeting">
      <span className="closing-host">
        <span className="closing-caption">Радий вас бачити!</span>
        <SeatedCharacter kind="lion" />
      </span>
      <span className="closing-host closing-host-pink">
        <span className="closing-caption">Мур-р! До зустрічі!</span>
        <SeatedCharacter kind="kitten" />
      </span>
    </div>
  );
}
