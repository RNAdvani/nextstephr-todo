import { gsap } from "gsap";

export function loginPageAnimations(container: HTMLElement | null) {
  if (!container) return () => {};

  const shapes = container.querySelectorAll("[data-gsap-shape]");
  const title = container.querySelector("[data-gsap-login-title]");
  const subtitle = container.querySelector("[data-gsap-login-subtitle]");
  const form = container.querySelector("[data-gsap-login-form]");
  const formFields = container.querySelectorAll("[data-gsap-login-field]");
  const submitBtn = container.querySelector("[data-gsap-login-submit]");
  const toggleLink = container.querySelector("[data-gsap-login-toggle]");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.from(shapes, {
    scale: 0,
    rotation: 360,
    opacity: 0,
    duration: 1.4,
    stagger: { each: 0.06, from: "random" },
    ease: "back.out(1.4)",
  })
    .fromTo(
      title,
      { y: -80, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: "elastic.out(1, 0.5)", clearProps: "transform,opacity" },
      "-=0.7"
    )
    .fromTo(
      subtitle,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity" },
      "-=0.45"
    )
    .fromTo(
      form,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: "power2.out", clearProps: "transform,opacity" },
      "-=0.35"
    )
    .fromTo(
      formFields,
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.07,
        ease: "back.out(1.2)",
        clearProps: "transform,opacity",
      },
      "-=0.4"
    )
    .fromTo(
      submitBtn,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.4)", clearProps: "transform,opacity" },
      "-=0.25"
    )
    .fromTo(
      toggleLink,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, clearProps: "transform,opacity" },
      "-=0.2"
    );

  return () => tl.kill();
}

export function todoPageAnimations(container: HTMLElement | null) {
  if (!container) return () => {};

  const header = container.querySelector("[data-gsap-todo-header]");
  const search = container.querySelector("[data-gsap-todo-search]");
  const addForm = container.querySelector("[data-gsap-todo-add-form]");
  const filters = container.querySelector("[data-gsap-todo-filters]");
  const list = container.querySelector("[data-gsap-todo-list]");
  const items = container.querySelectorAll("[data-gsap-todo-item]");
  const footer = container.querySelector("[data-gsap-todo-footer]");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  if (header) {
    tl.from(header, {
      y: -100,
      opacity: 0,
      duration: 0.85,
      ease: "elastic.out(1, 0.6)",
    });
  }
  if (search) {
    tl.from(search, {
      x: -60,
      opacity: 0,
      duration: 0.45,
      ease: "power3.out",
    }, "-=0.5");
  }
  if (addForm) {
    tl.from(addForm, {
      y: 40,
      opacity: 0,
      duration: 0.5,
      ease: "back.out(1.2)",
    }, "-=0.35");
  }
  if (filters) {
    const filterBtns = filters.querySelectorAll("button");
    tl.from(filters, {
      y: 24,
      opacity: 0,
      duration: 0.25,
      ease: "power2.out",
    }, "-=0.3");
    if (filterBtns.length) {
      tl.from(filterBtns, {
        y: 12,
        opacity: 0,
        duration: 0.35,
        stagger: 0.08,
        ease: "back.out(1.1)",
        clearProps: "transform,opacity",
      }, "-=0.2");
    }
  }
  if (list) {
    tl.from(list, { opacity: 0, duration: 0.2 }, "-=0.2");
  }
  if (items.length) {
    tl.fromTo(
      items,
      { x: 80, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.12,
        ease: "back.out(1.2)",
        clearProps: "transform,opacity",
      },
      "-=0.05"
    );
  }
  if (footer) {
    tl.from(footer, {
      y: 24,
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
    }, "-=0.45");
  }

  return () => tl.kill();
}

export function modalAnimations(backdrop: HTMLElement | null, content: HTMLElement | null) {
  if (!backdrop || !content) return () => {};

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: "opacity" })
    .fromTo(
      content,
      { scale: 0.8, y: 30, opacity: 0 },
      {
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.35,
        ease: "back.out(1.2)",
        clearProps: "transform,opacity",
      },
      "-=0.1"
    );

  return () => tl.kill();
}

