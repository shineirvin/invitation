(async function () {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Static export mode: content is baked into the page as window.SITE / window.WISHES
  const STATIC = !!window.SITE;
  const site = window.SITE || (await fetch('api/site').then((r) => r.json()));

  // ----- guest name from ?to= -----
  const params = new URLSearchParams(location.search);
  const guest = (params.get('to') || '').trim();
  if (guest) $('#guestName').textContent = guest;

  // ----- simple text binding -----
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const val = get(site, el.dataset.bind);
    if (val) el.textContent = val;
  });
  document.title = site.meta?.title || 'Undangan Pernikahan';

  // ----- photos -----
  // bingkai ornamen bisa dimatikan dari dashboard
  document.body.classList.toggle('no-frames', site.style?.frames === false);

  // framing tiap foto, diatur dari dashboard: geser (background-position) + zoom
  const photoPos = site.photoPos || {};
  const photoZoom = site.photoZoom || {};

  function frame(el, src, key) {
    if (photoPos[key]) el.style.backgroundPosition = photoPos[key];
    const zoom = Number(photoZoom[key]) || 1;
    if (zoom <= 1) return; // tanpa zoom, background-size: cover dari CSS sudah pas
    const img = new Image();
    img.onload = () => {
      // "cover" dihitung ulang lalu dikalikan zoom, supaya rasio foto tetap
      const fit = () => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const k = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight) * zoom;
        el.style.backgroundSize = `${img.naturalWidth * k}px ${img.naturalHeight * k}px`;
      };
      fit();
      window.addEventListener('resize', fit);
    };
    img.src = src;
  }

  if (site.hero?.coverPhoto) {
    document.querySelectorAll('[data-photo="cover"]').forEach((el) => {
      el.style.backgroundImage = `url('${encodeURI(site.hero.coverPhoto)}')`;
      frame(el, site.hero.coverPhoto, 'cover');
    });
  }
  // ----- per-section background photos -----
  const bgs = site.backgrounds || {};
  const sectionBg = {
    home: bgs.home || site.hero?.coverPhoto,
    events: bgs.events,
    savethedate: bgs.savethedate,
    story: bgs.story,
    gallery: bgs.gallery,
    rsvp: bgs.rsvp,
    gift: bgs.gift,
    closing: bgs.closing
  };
  Object.entries(sectionBg).forEach(([id, src]) => {
    const sec = document.getElementById(id);
    if (!src || !sec) return;
    const div = document.createElement('div');
    div.className = 'sec-bg';
    div.setAttribute('aria-hidden', 'true');
    div.style.backgroundImage = `url('${encodeURI(src)}')`;
    // home tanpa background sendiri memakai foto cover, jadi ikut framing cover
    frame(div, src, bgs[id] ? 'bg-' + id : 'cover');
    sec.prepend(div);
  });

  ['groom', 'bride'].forEach((who) => {
    const p = site.couple?.[who]?.photo;
    const el = document.querySelector(`[data-photo="${who}"]`);
    if (p && el) {
      el.style.backgroundImage = `url('${encodeURI(p)}')`;
      frame(el, p, who);
    }
    else if (el) el.closest('.person-slide')?.classList.add('no-photo');
    const ig = site.couple?.[who]?.instagram;
    const a = document.querySelector(`[data-ig="${who}"]`);
    if (ig && a) {
      a.hidden = false;
      a.href = 'https://instagram.com/' + ig.replace(/^@/, '');
      a.textContent = '@' + ig.replace(/^@/, '');
    }
  });

  // ----- events -----
  const svg = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    date: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
    time: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3 1.8"/>'),
    place: svg('<path d="M12 21.5s7-5.8 7-11.2a7 7 0 1 0-14 0c0 5.4 7 11.2 7 11.2z"/><circle cx="12" cy="10.2" r="2.5"/>')
  };

  $('#eventList').innerHTML = (site.events || [])
    .map(
      (ev) => `
      <div class="event-card">
        <h3>${esc(ev.name)}</h3>
        <ul class="event-meta">
          ${ev.dateText ? `<li>${ICON.date}<span class="event-when">${esc(ev.dateText)}</span></li>` : ''}
          ${ev.timeText ? `<li>${ICON.time}<span class="event-when">${esc(ev.timeText).replace(/\n/g, '<br>')}</span></li>` : ''}
          ${ev.venue || ev.address
            ? `<li>${ICON.place}<span>
                 <span class="event-venue">${esc(ev.venue)}</span>
                 ${ev.address ? `<span class="event-address">${esc(ev.address)}</span>` : ''}
               </span></li>`
            : ''}
        </ul>
        ${ev.mapsUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(ev.mapsUrl)}">Lihat Lokasi</a>` : ''}
      </div>`
    )
    .join('');

  // ----- countdown -----
  const targetTs = Date.parse(site.hero?.dateISO || '');
  if (!isNaN(targetTs)) {
    const tick = () => {
      const diff = Math.max(0, targetTs - Date.now());
      $('#cd-d').textContent = Math.floor(diff / 864e5);
      $('#cd-h').textContent = Math.floor((diff % 864e5) / 36e5);
      $('#cd-m').textContent = Math.floor((diff % 36e5) / 6e4);
      $('#cd-s').textContent = Math.floor((diff % 6e4) / 1e3);
    };
    tick();
    setInterval(tick, 1000);

    const start = new Date(targetTs);
    const end = new Date(targetTs + 4 * 36e5);
    const fmt = (dt) => dt.toISOString().replace(/[-:]|\.\d{3}/g, '');
    $('#calendarBtn').href =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(site.meta?.title || 'Pernikahan')}` +
      `&dates=${fmt(start)}/${fmt(end)}` +
      `&details=${encodeURIComponent('Undangan: ' + location.origin + location.pathname)}`;
  }

  // ----- journey of love -----
  const story = site.story || [];
  if (!story.length) $('#story').hidden = true;
  $('#storyList').innerHTML = story
    .map(
      (s) => `
      <div class="t-item reveal">
        <p class="t-head">${esc(s.year)} <span>— ${esc(s.title)}</span></p>
        <p>${esc(s.text)}</p>
      </div>`
    )
    .join('');

  // ----- gallery -----
  const gallery = site.gallery || [];
  const lbImages = [];

  // framing tiap foto galeri dari dashboard
  const galleryFrame = (g) => {
    const key = 'gallery-' + g.id;
    const [px, py] = (photoPos[key] || '50% 50%').split(' ');
    const x = parseFloat(px) || 50;
    const y = parseFloat(py) || 50;
    const z = Number(photoZoom[key]) || 1;
    // di carousel foto mengisi frame persis, jadi geser + zoom dijadikan satu transform
    // yang meniru background-position pada ukuran cover x zoom
    const t = (v) => ((v - 50) * (1 - z)) / z;
    const rail = z > 1 ? `transform:scale(${z}) translate(${t(x).toFixed(2)}%, ${t(y).toFixed(2)}%)` : '';
    // di grid "See all" foto dipotong 3/4, cukup object-position
    const grid = photoPos[key] ? `object-position:${x}% ${y}%` : '';
    return { rail, grid };
  };

  const galleryItem = (g, variant) => {
    if (g.type === 'video')
      return `<div class="g-item g-wide"><video src="${esc(g.src)}" controls playsinline preload="metadata"></video></div>`;
    if (g.type === 'youtube')
      return `<div class="g-item g-wide"><iframe src="https://www.youtube.com/embed/${esc(g.src)}" title="Video" allowfullscreen loading="lazy"></iframe></div>`;
    const i = lbImages.indexOf(g.src) >= 0 ? lbImages.indexOf(g.src) : lbImages.push(g.src) - 1;
    const style = galleryFrame(g)[variant];
    return `<div class="g-item"><img src="${esc(g.src)}" alt="Galeri foto" loading="lazy" data-lb="${i}"${style ? ` style="${style}"` : ''}></div>`;
  };

  const galleryHtml = gallery.map((g) => galleryItem(g, 'rail')).join('');
  const galleryGridHtml = gallery.map((g) => galleryItem(g, 'grid')).join('');

  // geser galeri ke kanan / kiri, foto tengah tajam, sisanya buram
  const rail = $('#galleryGrid');
  const railPrev = $('#galleryPrev');
  const railNext = $('#galleryNext');
  // looping hanya untuk galeri foto: menggandakan video/iframe berat di perangkat
  const loop = gallery.length > 2 && gallery.every((g) => g.type !== 'video' && g.type !== 'youtube');

  rail.innerHTML = gallery.length
    ? loop
      ? galleryHtml + galleryHtml + galleryHtml
      : galleryHtml
    : '<p class="gallery-empty">Foto dan video akan segera hadir.</p>';

  // tinggi frame tetap, lebarnya mengikuti rasio asli foto: lanskap jadi frame lebar,
  // potret tetap ramping — tidak ada ruang kosong dan tidak ada yang terpotong
  let anchorScroll = (fn) => fn();
  const fitFrame = (img) => {
    if (!img.naturalWidth || img.dataset.lb === undefined) return;
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    anchorScroll(() => {
      // semua salinan foto yang sama (termasuk set kloning untuk looping) ikut disesuaikan
      rail.querySelectorAll(`img[data-lb="${img.dataset.lb}"]`).forEach((el) => {
        el.parentElement.style.aspectRatio = ratio;
      });
    });
  };
  rail.addEventListener('load', (e) => fitFrame(e.target), true);

  if (gallery.length > 1) {
    railPrev.hidden = railNext.hidden = false;
    const items = [...rail.children];
    // lebar satu set foto (termasuk jarak antar foto), dipakai untuk melompat saat looping
    const setWidth = () => (loop ? items[gallery.length].offsetLeft - items[0].offsetLeft : 0);
    const centerOf = (el) => el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2;
    let focused = null;

    // lebar tiap frame berbeda, jadi panah memindahkan ke tengah foto berikutnya
    const slide = (dir) => {
      const i = items.indexOf(focused || items[0]) + dir;
      const next = items[Math.min(Math.max(i, 0), items.length - 1)];
      rail.scrollTo({ left: centerOf(next), behavior: 'smooth' });
    };

    const syncRail = () => {
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let active = items[0];
      let best = Infinity;
      items.forEach((el) => {
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < best) { best = d; active = el; }
      });
      if (active !== focused) {
        focused?.classList.remove('is-focus');
        active.classList.add('is-focus');
        focused = active;
      }
      railPrev.classList.toggle('is-off', !loop && rail.scrollLeft <= 4);
      railNext.classList.toggle('is-off', !loop && rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4);
    };

    // saat geseran berhenti dekat ujung, lompat satu set ke tengah — isinya identik jadi tak terlihat
    let idle;
    const recenter = () => {
      const w = setWidth();
      if (!w) return;
      if (rail.scrollLeft < w * 0.5) rail.scrollLeft += w;
      else if (rail.scrollLeft > w * 1.5) rail.scrollLeft -= w;
    };

    railPrev.addEventListener('click', () => slide(-1));
    railNext.addEventListener('click', () => slide(1));
    rail.addEventListener('scroll', () => {
      syncRail();
      if (!loop) return;
      clearTimeout(idle);
      idle = setTimeout(recenter, 150);
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (loop) rail.scrollLeft = centerOf(items[gallery.length]);
      syncRail();
    });

    // penyesuaian frame menggeser lebar rail; jaga foto yang sedang di tengah tetap di tempatnya
    anchorScroll = (fn) => {
      const anchor = focused || items[0];
      const before = anchor.offsetLeft;
      fn();
      rail.scrollLeft += anchor.offsetLeft - before;
      syncRail();
    };

    if (loop) rail.scrollLeft = centerOf(items[gallery.length]);
    syncRail();
  }

  // foto yang sudah selesai dimuat sebelum listener terpasang
  rail.querySelectorAll('img').forEach((img) => { if (img.complete) fitFrame(img); });

  // ----- see all -----
  const gAll = $('#galleryAll');
  if (gallery.length) {
    $('#galleryAllGrid').innerHTML = galleryGridHtml;
    $('#galleryAllBtn').hidden = false;
    $('#galleryAllBtn').addEventListener('click', () => {
      gAll.hidden = false;
      document.body.classList.add('locked');
    });
  }
  function gAllClose() {
    gAll.hidden = true;
    document.body.classList.remove('locked');
  }
  gAll.querySelector('.ga-close').addEventListener('click', gAllClose);

  // ----- lightbox -----
  const lightbox = $('#lightbox');
  const lbImg = $('#lbImg');
  let lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + lbImages.length) % lbImages.length;
    lbImg.src = lbImages[lbIndex];
    $('#lbCount').textContent = `${lbIndex + 1} / ${lbImages.length}`;
    lightbox.hidden = false;
  }
  function lbClose() {
    lightbox.hidden = true;
    lbImg.src = '';
  }
  const openFromGrid = (e) => {
    const i = e.target.dataset?.lb;
    if (i !== undefined) lbShow(Number(i));
  };
  $('#galleryGrid').addEventListener('click', openFromGrid);
  $('#galleryAllGrid').addEventListener('click', openFromGrid);
  lightbox.querySelector('.lb-close').addEventListener('click', lbClose);
  lightbox.querySelector('.lb-prev').addEventListener('click', () => lbShow(lbIndex - 1));
  lightbox.querySelector('.lb-next').addEventListener('click', () => lbShow(lbIndex + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lbClose();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) {
      if (e.key === 'Escape' && !gAll.hidden) gAllClose();
      return;
    }
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
    else if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
  });
  let touchX = null;
  lightbox.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  // ----- wishes -----
  const attLabel = { hadir: 'Hadir', tidak: 'Berhalangan', ragu: 'Belum pasti' };
  // ucapan ditampilkan per halaman, 5 ucapan tiap halaman
  const WISH_PER_PAGE = 5;
  let wishItems = [];
  let wishPage = 0;
  const wishHtml = (w) => `
        <div class="wish">
          <b>${esc(w.name)}</b><span class="w-meta">${esc(attLabel[w.attendance] || w.attendance || '')}</span>
          <p>${esc(w.message)}</p>
        </div>`;

  const wishPager = $('#wishPager');
  const wishPrev = $('#wishPrev');
  const wishNext = $('#wishNext');

  function renderWishPage() {
    const pages = Math.max(1, Math.ceil(wishItems.length / WISH_PER_PAGE));
    wishPage = Math.min(Math.max(wishPage, 0), pages - 1);
    const start = wishPage * WISH_PER_PAGE;
    $('#wishList').innerHTML =
      wishItems.slice(start, start + WISH_PER_PAGE).map(wishHtml).join('') ||
      '<p class="wish-empty">Belum ada ucapan. Jadilah yang pertama.</p>';
    wishPager.hidden = wishItems.length <= WISH_PER_PAGE;
    $('#wishPageInfo').textContent = `${wishPage + 1} / ${pages}`;
    wishPrev.disabled = wishPage === 0;
    wishNext.disabled = wishPage >= pages - 1;
  }

  const turnPage = (dir) => {
    wishPage += dir;
    renderWishPage();
    // setelah ganti halaman, mulai baca lagi dari ucapan teratas
    $('#wishList').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  wishPrev.addEventListener('click', () => turnPage(-1));
  wishNext.addEventListener('click', () => turnPage(1));

  function renderWishes(wishes) {
    wishItems = wishes;
    wishPage = 0;
    renderWishPage();
  }

  const sheetsUrl = String(site.meta?.sheetsUrl || '').trim();
  const waNumber = String(site.meta?.whatsapp || '').replace(/\D/g, '');

  async function loadWishes() {
    // once a Google Sheet is configured it is the single source of truth,
    // on the local preview as well as on the exported static site
    let sheetRows = null;
    if (sheetsUrl) {
      try {
        sheetRows = await fetch(sheetsUrl).then((r) => r.json());
      } catch {
        sheetRows = null;
      }
    }
    if (STATIC) return renderWishes([...(sheetRows || []), ...(window.WISHES || [])]);
    if (sheetRows) return renderWishes(sheetRows);
    renderWishes(await fetch('api/wishes').then((r) => r.json()));
  }
  loadWishes();

  if (STATIC && !sheetsUrl && !waNumber) {
    // static hosting with no RSVP backend configured: show wishes only
    $('#wishForm').hidden = true;
  }

  $('#wishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const note = $('#wishNote');

    if (sheetsUrl) {
      note.hidden = false;
      note.textContent = 'Mengirim…';
      try {
        // URLSearchParams body avoids a CORS preflight, which Apps Script can't answer
        const res = await fetch(sheetsUrl, {
          method: 'POST',
          body: new URLSearchParams({
            name: form.name.value,
            message: form.message.value,
            attendance: attLabel[form.attendance.value] || form.attendance.value,
            guests: form.guests.value
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || 'Gagal mengirim.');
        note.textContent = 'Terima kasih! Ucapan Anda sudah terkirim.';
        form.message.value = '';
        loadWishes();
      } catch (err) {
        note.textContent = err.message || 'Gagal mengirim. Coba lagi ya.';
      }
      return;
    }

    if (STATIC) {
      const att = attLabel[form.attendance.value] || form.attendance.value;
      const text =
        `Konfirmasi kehadiran — ${site.meta?.title || 'Pernikahan'}\n` +
        `Nama: ${form.name.value}\n` +
        `Kehadiran: ${att} (${form.guests.value} tamu)\n` +
        `Ucapan: ${form.message.value}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
      note.hidden = false;
      note.textContent = 'Ucapan Anda dikirim melalui WhatsApp. Terima kasih!';
      return;
    }

    const res = await fetch('api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.value,
        message: form.message.value,
        attendance: form.attendance.value,
        guests: form.guests.value
      })
    });
    note.hidden = false;
    if (res.ok) {
      note.textContent = 'Terima kasih! Ucapan Anda sudah terkirim.';
      form.message.value = '';
      loadWishes();
    } else {
      const err = await res.json().catch(() => ({}));
      note.textContent = err.error || 'Gagal mengirim. Coba lagi ya.';
    }
  });

  if (guest && !$('#wishForm').name.value) $('#wishForm').name.value = guest;

  // ----- gift -----
  const accounts = site.gift?.accounts || [];
  if (!accounts.length && !site.gift?.address) $('#gift').hidden = true;
  $('#accountList').innerHTML = accounts
    .map(
      (a) => `
      <div class="account reveal">
        <div class="a-bank">${esc(a.bank)}</div>
        <div class="a-number">${esc(a.number)}</div>
        <div class="a-holder">a.n. ${esc(a.holder)}</div>
        <button class="btn" data-copy="${esc(a.number)}">Salin Nomor</button>
      </div>`
    )
    .join('');
  if (site.gift?.address) $('#giftAddress').hidden = false;

  document.querySelectorAll('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Tersalin';
        setTimeout(() => (btn.textContent = 'Salin Nomor'), 2000);
      } catch {
        btn.textContent = btn.dataset.copy;
      }
    })
  );

  // ----- menu -----
  const menu = $('#menu');
  $('#menuBtn').addEventListener('click', () => (menu.hidden = false));
  $('#menuClose').addEventListener('click', () => (menu.hidden = true));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => (menu.hidden = true)));

  // ----- music -----
  const audio = $('#bgMusic');
  const musicBtn = $('#musicBtn');
  if (site.music) {
    audio.src = site.music;
    musicBtn.hidden = false;
    musicBtn.addEventListener('click', () => {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    audio.addEventListener('play', () => musicBtn.classList.add('playing'));
    audio.addEventListener('pause', () => musicBtn.classList.remove('playing'));
  }

  // ----- reveal on scroll -----
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          observer.unobserve(en.target);
        }
      }),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  // ----- opening cover -----
  document.body.classList.add('locked');
  $('#openBtn').addEventListener('click', () => {
    $('#cover').classList.add('opened');
    document.body.classList.remove('locked');
    // triggers the staged fade-in of the home and backdrop names
    document.body.classList.add('play');
    if (site.music) audio.play().catch(() => {});
  });
})();
