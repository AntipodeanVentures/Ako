/* Ako landing page interactions:
   the walkthrough player, the scrolling nav, and reveal-on-scroll. */
(function () {
  'use strict';

  /* ---------------- Nav ---------------- */
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');

  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener('click', function () {
    var open = nav.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------------- Reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            revObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    revealEls.forEach(function (el) {
      revObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('in');
    });
  }

  /* ---------------- Walkthrough player ---------------- */
  var player = document.querySelector('.player');
  if (!player) return;

  var frames = Array.prototype.slice.call(document.querySelectorAll('.wt-frame'));
  var captions = Array.prototype.slice.call(
    document.querySelectorAll('.wt-captions li'),
  );
  var dotsWrap = document.getElementById('dots');
  var playBtn = document.getElementById('playBtn');
  var trackFill = document.getElementById('trackFill');
  var total = frames.length;

  var FRAME_MS = 5200;
  var current = 0;
  var frameElapsed = 0;
  var paused = false;
  var lastNow = (window.performance || Date).now();

  // Build the step dots.
  var dots = [];
  for (var i = 0; i < total; i++) {
    (function (index) {
      var dot = document.createElement('button');
      dot.setAttribute('aria-label', 'Step ' + (index + 1));
      dot.addEventListener('click', function () {
        setFrame(index);
      });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    })(i);
  }

  function setFrame(index) {
    current = ((index % total) + total) % total;
    frameElapsed = 0;
    trackFill.style.width = '0%';
    for (var n = 0; n < total; n++) {
      frames[n].classList.toggle('is-active', n === current);
      if (captions[n]) captions[n].classList.toggle('is-active', n === current);
      dots[n].classList.toggle('is-on', n === current);
    }
  }

  function setPaused(value) {
    paused = value;
    player.classList.toggle('paused', paused);
    playBtn.setAttribute(
      'aria-label',
      paused ? 'Play walkthrough' : 'Pause walkthrough',
    );
  }

  playBtn.addEventListener('click', function () {
    setPaused(!paused);
  });

  function tick(now) {
    var dt = now - lastNow;
    lastNow = now;
    if (!paused && !document.hidden) {
      frameElapsed += dt;
      var progress = Math.min(frameElapsed / FRAME_MS, 1);
      trackFill.style.width = progress * 100 + '%';
      if (progress >= 1) setFrame(current + 1);
    }
    window.requestAnimationFrame(tick);
  }

  setFrame(0);
  window.requestAnimationFrame(tick);
})();
