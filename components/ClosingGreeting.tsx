import AnimatedCharacter from "./AnimatedCharacter";

export default function ClosingGreeting({ active = true }: { active?: boolean }) {
  return (
    <div className="closing-greeting">
      <span className="closing-host">
        <span className="closing-caption">Радий вас бачити!</span>
      </span>
      <span className="closing-host closing-host-pink">
        <span className="closing-caption">Мур-р! До зустрічі!</span>
      </span>
      <AnimatedCharacter kind="together" enabled={active} />
    </div>
  );
}
