"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowDown,
  CalendarDays,
  Heart,
  Menu,
  MailOpen,
  X,
} from "lucide-react";
import { EVENT } from "@/lib/event";
import Opening from "./Opening";
import SplitText from "./SplitText";
import SeatedCharacter from "./SeatedCharacter";
import SharedInvitationCharacters from "./SharedInvitationCharacters";
import AnimatedCharacter from "./AnimatedCharacter";
import {
  Balloon,
  Butterfly,
  Ribbon,
  Star,
  CelebrationThread,
} from "./Artwork";
import Countdown from "./Countdown";
import Calendar from "./Calendar";
import Letters from "./Letters";
import RSVP from "./RSVP";
import ClosingGreeting from "./ClosingGreeting";
import ClosingConfetti from "./ClosingConfetti";
import VenueSection from "./VenueSection";
import { MusicToggle, useBackgroundMusic } from "./BackgroundMusic";
gsap.registerPlugin(useGSAP, ScrollTrigger);
export default function Invitation() {
  const { audioRef, muted: musicMuted, start: startMusic, toggle: toggleMusic } = useBackgroundMusic();
  const [opening, setOpening] = useState(true);
  const [menu, setMenu] = useState(false);
  const [opened, setOpened] = useState(false);
  const [morphed, setMorphed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const replayOpening = () => {
    setMenu(false);
    setOpened(false);
    setMorphed(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
    setOpening(true);
  };
  const finishOpening = useCallback((didMorph = false) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setOpening(false);
    setMorphed(didMorph);
    setOpened(true);
  }, []);
  useEffect(() => {
    if (opened)
      document.getElementById("hero-title")?.focus({ preventScroll: true });
  }, [opened]);
  useGSAP(
    () => {
      if (opening) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const mobile = window.matchMedia("(max-width: 767px)").matches;
        const heroMotion = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: "hero-parallax",
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        heroMotion
          .to(
            ".hero-air-layer",
            { y: () => (window.innerWidth < 768 ? -150 : -235) },
            0,
          )
          .to(
            ".hero-cloud-layer",
            { y: () => (window.innerWidth < 768 ? -48 : -85) },
            0,
          )
          .to(
            ".hero-lion-depth",
            { y: () => (window.innerWidth <= 1100 ? -12 : -145), rotation: () => window.innerWidth <= 1100 ? 0 : -3 },
            0,
          )
          .to(
            ".hero-kitten-depth",
            { y: () => (window.innerWidth <= 1100 ? -12 : -190), rotation: () => window.innerWidth <= 1100 ? 0 : 3 },
            0,
          )
          .to(".hero-spark-depth", { y: mobile ? -95 : -170 }, 0);
        gsap.from(".story-ribbon path", {
          strokeDashoffset: 1000,
          strokeDasharray: 1000,
          duration: 2,
          scrollTrigger: { trigger: ".stories", start: "top 65%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [opening], revertOnUpdate: true },
  );
  return (
    <>
      <div ref={root} inert={opening} className="invitation">
        <a className="skip-link" href="#main">
          До змісту
        </a>
        <header className="site-header">
          <a
            className="wordmark"
            href="#home"
            aria-label="Владислав та Лілія, на початок"
          >
            <span>В</span>
            <Heart size={17} />
            <span>Л</span>
          </a>
          <nav
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setMenu(false);
                menuButton.current?.focus();
              }
            }}
            aria-label="Головна навігація"
            className={menu ? "is-open" : ""}
          >
            <a href="#stories" onClick={() => setMenu(false)}>
              Наші іменинники
            </a>
            <a href="#date" onClick={() => setMenu(false)}>
              Коли й де
            </a>
            <a href="#letters" onClick={() => setMenu(false)}>
              Листи у майбутнє
            </a>
            <a className="nav-rsvp" href="#rsvp" onClick={() => setMenu(false)}>
              Буду на святі <Heart size={14} />
            </a>
          </nav>
          <div className="header-actions">
            <button
              className="replay-invitation"
              onClick={replayOpening}
              aria-label="Відкрити запрошення ще раз"
              title="Відкрити запрошення ще раз"
            >
              <MailOpen size={23} />
            </button>
            <button
              ref={menuButton}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMenu(false);
              }}
              className="menu-toggle"
              aria-label={menu ? "Закрити меню" : "Відкрити меню"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        <main id="main">
          <section id="home" className="hero">
            <div className="hero-air-layer" aria-hidden="true">
              <HeroFrame />
            </div>
            <div className="hero-cloud-layer" aria-hidden="true">
              <HeroFrame />
            </div>
            <div className="hero-spark-depth" aria-hidden="true">
              <Star className="hero-star star-one" />
              <Star className="hero-star star-two" />
              <Butterfly className="hero-butterfly" />
            </div>
            <div className="hero-copy">
              <p className="hero-invitation" data-morph="invitation">Запрошуємо на день народження</p>
              <h1 id="hero-title" tabIndex={-1} className="hero-names">
                <SplitText text="Владислава" active={!opening} settled={morphed} morphKey="lion-name" />
                <small data-morph="conjunction">та</small>
                <SplitText text="Лілії" active={!opening} settled={morphed} morphKey="kitten-name" delay={45} />
              </h1>
              <div className="age-note">
                <span className="age-line" />
                <p data-morph="age">
                  Нам виповнюється <strong>2 рочки!</strong>
                </p>
                <span className="age-line" />
              </div>
              <p className="hero-description">
                <strong>
                  Два маленькі серденька.
                  <br />
                  Один незабутній день.
                </strong>
                <span>
                  Будемо дуже раді розділити
                  <br className="desktop-break" /> це свято разом із вами!
                </span>
              </p>
              <a className="hero-date" href="#date">
                <CalendarDays size={18} />
                {EVENT.date}
                <span>16:00</span>
              </a>
            </div>
            <div className="hero-characters">
              <div className="hero-lion hero-lion-depth">
                <SeatedCharacter kind="lion" shared />
              </div>
              <div className="hero-kitten hero-kitten-depth">
                <SeatedCharacter kind="kitten" shared />
              </div>
            </div>
            <a href="#stories" className="scroll-cue">
              <span>Наша маленька казка</span>
              <ArrowDown size={17} />
            </a>
          </section>
          <section id="stories" className="stories section">
            <div className="section-heading">
              <CelebrationThread />
              <h2>
                Дві маленькі історії.
                <br />
                Одне велике свято.
              </h2>
              <p>
                Ми різні, але найщасливіші миті — спільні.
                <br />А цього дня наша радість стане вдвічі більшою.
              </p>
            </div>
            <svg
              className="story-ribbon"
              viewBox="0 0 1000 720"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M140 110C500-120 1060 180 650 320S-100 440 250 600 940 650 900 500"
                fill="none"
                stroke="#cfb48e"
                strokeWidth="1.3"
                strokeDasharray="5 10"
                opacity=".5"
              />
            </svg>
            <article className="child-story story-blue">
              <div className="story-illustration story-animated">
                <AnimatedCharacter kind="lion" enabled={!opening} />
              </div>
              <div className="story-copy">
                <h3>
                  Наше маленьке левеня <span>Владислав</span>
                </h3>
                <p>
                  Любить пригоди, машинки, м’ячики та дарує всім навколо
                  найщиріші усмішки.
                </p>
                <span className="story-handwriting">
                  У кожному дні — нова пригода!
                </span>
              </div>
            </article>
            <article className="child-story story-pink">
              <div className="story-illustration story-animated">
                <AnimatedCharacter kind="kitten" enabled={!opening} />
              </div>
              <div className="story-copy">
                <h3>
                  Наша маленька принцеса <span>Лілія</span>
                </h3>
                <p>
                  Обожнює котиків, ніжність, чарівні дрібнички та наповнює світ
                  радістю.
                </p>
                <span className="story-handwriting">
                  Маленька мрійниця з великим серцем.
                </span>
              </div>
            </article>
          </section>
          <Countdown />
          <Calendar />
          <VenueSection active={!opening} />
          <Letters />
          <RSVP />
          <section className="closing section">
            <ClosingConfetti active={!opening} />
            <Balloon className="closing-balloon" />
            <Balloon color="pink" className="closing-balloon pink" />
            <Balloon
              color="gold"
              className="closing-balloon closing-balloon-gold"
            />
            <Balloon
              color="sage"
              className="closing-balloon closing-balloon-sage"
            />
            <h2>Ми дуже чекаємо на вас!</h2>
            <p>З любов’ю, Владислав та Лілія</p>
            <ClosingGreeting />
            <Ribbon className="closing-bow left" />
            <Ribbon className="closing-bow right" />
            <p className="closing-date">
              15 листопада 2026 <Heart size={12} /> FRANCO
            </p>
            <button
              type="button"
              className="button closing-replay"
              onClick={replayOpening}
            >
              <MailOpen size={21} aria-hidden="true" />
              Відкрити конверт ще раз
            </button>
          </section>
        </main>
      </div>
      <audio ref={audioRef} src="/audio/birthday-background.mp3" loop preload="none" aria-hidden="true" />
      {!opening ? (
        <div className="music-dock">
          <MusicToggle muted={musicMuted} onToggle={toggleMusic} />
        </div>
      ) : null}
      {opening ? (
        <Opening onOpened={finishOpening} onOpenStart={startMusic} musicMuted={musicMuted} onMusicToggle={toggleMusic} />
      ) : null}
      <SharedInvitationCharacters opening={opening} />
      <noscript>
        <style>{".invitation{display:block!important}"}</style>
        <p className="noscript-note">
          Увімкніть JavaScript для заповнення листів. Інформація про свято
          доступна нижче.
        </p>
      </noscript>
    </>
  );
}

function HeroFrame() {
  return (
    <picture className="hero-frame">
      <source
        media="(max-width: 767px)"
        srcSet="/art/celebration-frame-mobile.webp"
      />
      <Image
        src="/art/celebration-frame.webp"
        alt=""
        width={1536}
        height={1024}
        priority
        sizes="100vw"
      />
    </picture>
  );
}
