import { useEffect, useState, useRef } from "react";
import { supabase } from "./lib/supabase";
import { AppRouter } from "./util/router";
import { gsap } from "gsap";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const loaderRingRef = useRef<HTMLDivElement>(null);
  const loaderTextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) return;
    const ring = loaderRingRef.current;
    const text = loaderTextRef.current;
    if (!ring || !text) return;

    gsap.from(ring, {
      scale: 0,
      opacity: 0,
      duration: 0.5,
      ease: "back.out(1.4)",
    });
    gsap.from(text, { opacity: 0, y: 8, duration: 0.4, delay: 0.2 });
    const spin = gsap.to(ring, {
      rotation: 360,
      duration: 1,
      ease: "none",
      repeat: -1,
    });
    return () => {
      spin.kill();
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div
            ref={loaderRingRef}
            className="inline-block rounded-full h-12 w-12 border-4 border-border border-t-primary mb-4"
          />
          <p ref={loaderTextRef} className="text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return <AppRouter user={user} />;
}
