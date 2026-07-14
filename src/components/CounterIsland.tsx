import { useEffect, useRef, useState } from "preact/hooks";

interface Props {
  value: number;
  durationMs?: number;
}

// Server-rendered output shows the real final value (so no-JS users, crawlers,
// and share-card scrapers see the correct number); once hydrated, it resets
// to 0 and animates up as a visual flourish. aria-hidden because a sibling
// static text node (see Counter.astro) is the accessible value — screen
// readers shouldn't announce every intermediate tick of the animation.
export default function CounterIsland({ value, durationMs = 1200 }: Props) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || value === 0) return;
    started.current = true;
    setDisplay(0);

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress); // ease-out
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <span aria-hidden="true">{display.toLocaleString("en-US")}</span>;
}
