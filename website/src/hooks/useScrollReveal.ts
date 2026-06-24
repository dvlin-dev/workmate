/**
 * useScrollReveal — IntersectionObserver 驱动的滚动入场动画。
 * 依赖 globals.css 的 scroll-reveal 动画类。
 */

import { useEffect, useRef } from 'react';

type Animation = 'fade-up' | 'fade-in' | 'scale-up' | 'slide-left' | 'slide-right';

interface ScrollRevealOptions {
  animation?: Animation;
  duration?: number;
  delay?: number;
  threshold?: number;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const { animation = 'fade-up', duration = 600, delay = 0, threshold = 0.1 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add('scroll-reveal');
    el.dataset.animation = animation;
    el.style.animationDuration = `${duration}ms`;
    if (delay > 0) el.style.animationDelay = `${delay}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animation, duration, delay, threshold]);

  return ref;
}

export function useScrollRevealGroup<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions & { stagger?: number } = {}
) {
  const { animation = 'fade-up', duration = 600, delay = 0, stagger = 80, threshold = 0.1 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>('[data-reveal-item]');
    items.forEach((item, i) => {
      item.classList.add('scroll-reveal');
      item.dataset.animation = animation;
      item.style.animationDuration = `${duration}ms`;
      item.style.animationDelay = `${delay + i * stagger}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          items.forEach((item) => item.classList.add('is-visible'));
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [animation, duration, delay, stagger, threshold]);

  return ref;
}
