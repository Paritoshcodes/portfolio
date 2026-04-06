---
name: gsap-scroll-scenes
description: Implement GTA VI and Apple-style pinned full-viewport scroll scenes using GSAP ScrollTrigger. Use this skill whenever building cinematic scroll storytelling, scroll-scrubbed reveals, or pinned section transitions in a web project.
---

# GSAP scroll-pinned scene pattern

## HTML structure

Each scene needs a scroll spacer div and a sticky inner container. The spacer height controls how long the scene stays pinned. The sticky container holds the actual visible content.

  section.project-scene
    div.scene-spacer   — height 300vh, creates scroll distance
    div.scene-sticky   — position sticky, top 0, height 100vh, overflow hidden

## CSS rules

  .project-scene  { position: relative; }
  .scene-spacer   { height: 300vh; }
  .scene-sticky   { position: sticky; top: 0; height: 100vh; overflow: hidden; }

## GSAP timeline setup

Call gsap.registerPlugin(ScrollTrigger) once at the top of main.js before any other GSAP code.

Wrap all scroll scene code in window.addEventListener('load', function() { ... })

Loop pattern:

  gsap.utils.toArray('.project-scene').forEach(function(scene) {
    var sticky = scene.querySelector('.scene-sticky');

    gsap.timeline({
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: '+=300%',
        scrub: 1,
        pin: sticky,
        anticipatePin: 1
      }
    })
    .from('.scene-glass', { y: 80, opacity: 0, duration: 0.4 }, 0.1)
    .from('.scene-title', { y: 30, opacity: 0, duration: 0.3 }, 0.2);
  });

  ScrollTrigger.refresh();

## Critical rules

- Always use scrub: 1 (a number), never scrub: true — the number adds smoothing lag
- Always use anticipatePin: 1 to prevent visible jump when pinning starts
- Always call ScrollTrigger.refresh() after all tweens are registered and fonts and images are loaded
- Always wrap in window load event, not DOMContentLoaded
- Use gsap.matchMedia() to disable pins on mobile

## Mobile pattern

  var mm = gsap.matchMedia();

  mm.add('(min-width: 768px)', function() {
    // all pinned scroll scene code here
  });

  mm.add('(max-width: 767px)', function() {
    // IntersectionObserver fade-ins here
  });

## Video scrubbing pattern (if project uses video instead of screenshots)

  function videoScrub(video, stVars) {
    function init() {
      gsap.fromTo(video,
        { currentTime: 0 },
        { currentTime: video.duration, ease: 'none', scrollTrigger: stVars }
      );
    }
    if (video.readyState >= 1) {
      init();
    } else {
      video.addEventListener('loadedmetadata', init, { once: true });
    }
  }

  Usage:
  videoScrub(document.querySelector('.hero-video'), {
    trigger: '.hero-scene',
    start: 'top top',
    end: '+=400%',
    scrub: 1,
    pin: true
  });