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
  if (site.hero?.coverPhoto) {
    document.querySelectorAll('[data-photo="cover"]').forEach((el) => {
      el.style.backgroundImage = `url('${encodeURI(site.hero.coverPhoto)}')`;
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
    sec.prepend(div);
  });

  ['groom', 'bride'].forEach((who) => {
    const p = site.couple?.[who]?.photo;
    const el = document.querySelector(`[data-photo="${who}"]`);
    if (p && el) el.style.backgroundImage = `url('${encodeURI(p)}')`;
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
  $('#eventList').innerHTML = (site.events || [])
    .map(
      (ev) => `
      <div class="event-card reveal">
        <h3>${esc(ev.name)}</h3>
        <p class="event-when">${esc(ev.dateText)}<br>${esc(ev.timeText).replace(/\n/g, '<br>')}</p>
        <p class="event-venue">${esc(ev.venue)}</p>
        <p class="event-address">${esc(ev.address)}</p>
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
  $('#galleryGrid').innerHTML = gallery.length
    ? gallery
        .map((g) => {
          if (g.type === 'video')
            return `<div class="g-item g-wide reveal"><video src="${esc(g.src)}" controls playsinline preload="metadata"></video></div>`;
          if (g.type === 'youtube')
            return `<div class="g-item g-wide reveal"><iframe src="https://www.youtube.com/embed/${esc(g.src)}" title="Video" allowfullscreen loading="lazy"></iframe></div>`;
          lbImages.push(g.src);
          return `<div class="g-item reveal"><img src="${esc(g.src)}" alt="Galeri foto" loading="lazy" data-lb="${lbImages.length - 1}"></div>`;
        })
        .join('')
    : '<p class="gallery-empty">Foto dan video akan segera hadir.</p>';

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
  $('#galleryGrid').addEventListener('click', (e) => {
    const i = e.target.dataset?.lb;
    if (i !== undefined) lbShow(Number(i));
  });
  lightbox.querySelector('.lb-close').addEventListener('click', lbClose);
  lightbox.querySelector('.lb-prev').addEventListener('click', () => lbShow(lbIndex - 1));
  lightbox.querySelector('.lb-next').addEventListener('click', () => lbShow(lbIndex + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lbClose();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
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
  function renderWishes(wishes) {
    $('#wishList').innerHTML = wishes
      .map(
        (w) => `
        <div class="wish">
          <b>${esc(w.name)}</b><span class="w-meta">${esc(attLabel[w.attendance] || w.attendance || '')}</span>
          <p>${esc(w.message)}</p>
        </div>`
      )
      .join('');
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
