// ==========================================================================
// COUGAR - Shared Liquid Glass Interactive Logic & Rich Scroll Animations
// ==========================================================================

// Global Toast Notification Helper
// Keep a single notification visible at a time so rapid clicks never create a stack.
let activeToastTimer = null;

window.showToast = function(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Remove any previous notification immediately.
  toastContainer.replaceChildren();
  if (activeToastTimer) {
    clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-up`;

  const icon = type === 'success' ? 'fa-circle-check' : (type === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation');

  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <div class="toast-message">${message}</div>
    <button class="toast-close" type="button" aria-label="Close notification">&times;</button>
  `;

  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    if (activeToastTimer) clearTimeout(activeToastTimer);
    activeToastTimer = null;
    toast.remove();
  });

  toastContainer.appendChild(toast);

  // Short, simple confirmation. A new notification replaces this one.
  activeToastTimer = setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 220);
    activeToastTimer = null;
  }, 1800);
};

// Global Scroll Animation Observer
let scrollObserver = null;

window.initScrollAnimations = function() {
  const observerOptions = {
    threshold: 0.08,
    rootMargin: '0px 0px -30px 0px'
  };

  if (!scrollObserver) {
    scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          scrollObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);
  }

  // Observe all scroll animation targets
  document.querySelectorAll('.reveal-on-scroll, .fade-up, .fade-left, .fade-right, .zoom-in, .stagger-item').forEach(el => {
    if (!el.classList.contains('is-visible')) {
      scrollObserver.observe(el);
    }
  });
};

// Initialize App Features on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  window.initScrollAnimations();
  initCounters();
  initActiveNavLink();
  initNewsletter();
});

// 1. Liquid Glass Floating Pill Navbar with Scroll Transitions
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });

    // Close menu when clicking nav links on mobile
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navbar.contains(e.target) && navMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
      }
    });
  }
}

// 2. Active Navigation Link Highlighting
function initActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (linkHref === currentPath || (currentPath === '' && linkHref === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 3. Number Counters Animation
function initCounters() {
  const counters = document.querySelectorAll('.counter-number');
  if (counters.length === 0) return;

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10);
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 1800;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - (1 - progress) * (1 - progress);
          const currentVal = Math.floor(easeProgress * target);

          el.textContent = `${prefix}${currentVal.toLocaleString()}${suffix}`;

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = `${prefix}${target.toLocaleString()}${suffix}`;
          }
        }

        requestAnimationFrame(updateCounter);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  counters.forEach(counter => counterObserver.observe(counter));
}

// 4. Newsletter Form Submission Handling
function initNewsletter() {
  const forms = document.querySelectorAll('.newsletter-form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input && input.value.trim()) {
        window.showToast(`Welcome to COUGAR VIP, ${input.value.trim()}! Your $100 pass has been emailed.`, 'success');
        input.value = '';
      }
    });
  });
}

// Helper to format currency
window.formatCurrency = function(amount) {
  return 'AED ' + Number(amount).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// Render stars utility
window.renderStars = function(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  let starsHtml = '';

  for (let i = 0; i < fullStars; i++) {
    starsHtml += '<i class="fa-solid fa-star star-filled"></i>';
  }
  if (hasHalf) {
    starsHtml += '<i class="fa-solid fa-star-half-stroke star-filled"></i>';
  }
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    starsHtml += '<i class="fa-regular fa-star star-empty"></i>';
  }
  return starsHtml;
};
