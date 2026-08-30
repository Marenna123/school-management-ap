/* School branding + logo upload module
 * Integrates the tested Supabase Storage logo flow into School Management V2.
 */
(() => {
  const MAX_LOGO_BYTES = 100 * 1024;
  const MAX_DIMENSION = 800;
  const BUCKET = 'school-logos';

  function getClient() {
    return window.sb || (window.supabase && window.SUPABASE_CONFIG
      ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)
      : null);
  }

  function optimizeLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
        reject(new Error('Please choose a PNG, JPG or WebP image.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
          let i = 0;
          const next = () => canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Could not optimize the logo.'));
            if (blob.size <= MAX_LOGO_BYTES) return resolve(blob);
            if (i === qualities.length - 1) return reject(new Error('This logo could not be compressed below 100 KB. Please choose a simpler image.'));
            i += 1;
            next();
          }, 'image/webp', qualities[i]);
          next();
        };
        img.onerror = () => reject(new Error('Could not read the image.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadLogo(fileOrBlob, schoolId, oldUrl) {
    const client = getClient();
    if (!client) throw new Error('Supabase is not ready.');
    if (!schoolId) throw new Error('School record is not ready.');
    const blob = fileOrBlob instanceof Blob ? fileOrBlob : await optimizeLogo(fileOrBlob);
    const path = `${schoolId}/${Date.now()}.webp`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp', upsert: false, cacheControl: '31536000'
    });
    if (uploadError) throw uploadError;
    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(path);
    const logoUrl = publicData.publicUrl;
    const { error: dbError } = await client.from('schools').update({ logo_url: logoUrl }).eq('id', schoolId);
    if (dbError) {
      await client.storage.from(BUCKET).remove([path]);
      throw dbError;
    }
    if (oldUrl && oldUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const oldPath = oldUrl.split(marker)[1];
      if (oldPath) await client.storage.from(BUCKET).remove([oldPath]);
    }
    return logoUrl;
  }

  function style() {
    if (document.getElementById('schoolBrandingStyle')) return;
    const s = document.createElement('style');
    s.id = 'schoolBrandingStyle';
    s.textContent = `
      .school-branding-card{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
      .school-branding-preview{width:110px;height:110px;object-fit:contain;border:1px dashed #94a3b8;border-radius:12px;background:#fff;padding:6px}
      .school-branding-info{flex:1;min-width:240px}
      .school-branding-status{margin-top:9px;padding:9px;border-radius:8px;background:#f8fafc;font-size:13px}
      .school-branding-status.ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
      .school-branding-status.err{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
      .school-branding-header-logo{width:42px;height:42px;object-fit:contain;vertical-align:middle;margin-right:9px;border-radius:7px;background:#fff;padding:2px}
    `;
    document.head.appendChild(s);
  }

  async function loadSchool() {
    const client = getClient();
    if (!client) return null;
    const auth = await client.auth.getUser();
    const user = auth.data?.user;
    if (!user) return null;
    const result = await client.from('schools').select('id,name,logo_url').eq('owner_id', user.id).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  function renderHeader(school) {
    if (!school?.logo_url) return;
    const h1 = document.querySelector('body > header h1');
    if (!h1 || h1.querySelector('.school-branding-header-logo')) return;
    const img = document.createElement('img');
    img.className = 'school-branding-header-logo';
    img.src = school.logo_url;
    img.alt = 'School logo';
    h1.prepend(img);
  }

  async function installV2() {
    const structure = document.getElementById('structure');
    if (!structure || document.getElementById('schoolBrandingCard')) return;
    style();

    const card = document.createElement('div');
    card.id = 'schoolBrandingCard';
    card.className = 'card';
    card.innerHTML = `
      <h3>🎨 School Branding</h3>
      <div class="school-branding-card">
        <img id="schoolBrandingPreview" class="school-branding-preview" alt="School logo preview">
        <div class="school-branding-info">
          <b>School logo</b>
          <p class="muted">Upload your school logo once. It is optimized to 100 KB or less and saved securely in Supabase.</p>
          <input id="schoolBrandingFile" type="file" accept="image/png,image/jpeg,image/webp">
          <div id="schoolBrandingStatus" class="school-branding-status">Loading school branding…</div>
          <button id="schoolBrandingSave" class="btn green" type="button" disabled>Save Logo</button>
        </div>
      </div>`;
    structure.insertBefore(card, structure.firstElementChild);

    const input = document.getElementById('schoolBrandingFile');
    const preview = document.getElementById('schoolBrandingPreview');
    const status = document.getElementById('schoolBrandingStatus');
    const saveButton = document.getElementById('schoolBrandingSave');
    let school = null;
    let pendingBlob = null;

    try {
      school = await loadSchool();
      if (!school) throw new Error('Please sign in to the school app first.');
      if (school.logo_url) {
        preview.src = school.logo_url;
        status.textContent = 'Current school logo is loaded from cloud.';
        status.className = 'school-branding-status ok';
        renderHeader(school);
      } else {
        status.textContent = 'No logo saved yet. Choose a logo to begin.';
      }
    } catch (e) {
      status.textContent = e.message || String(e);
      status.className = 'school-branding-status err';
      return;
    }

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      saveButton.disabled = true;
      try {
        status.textContent = 'Optimizing logo…';
        status.className = 'school-branding-status';
        pendingBlob = await optimizeLogo(file);
        preview.src = URL.createObjectURL(pendingBlob);
        status.textContent = `Ready • ${(pendingBlob.size / 1024).toFixed(1)} KB`;
        status.className = 'school-branding-status ok';
        saveButton.disabled = false;
      } catch (e) {
        pendingBlob = null;
        input.value = '';
        preview.src = school.logo_url || '';
        status.textContent = e.message || String(e);
        status.className = 'school-branding-status err';
      }
    });

    saveButton.addEventListener('click', async () => {
      if (!pendingBlob || !school) return;
      saveButton.disabled = true;
      status.textContent = 'Uploading logo…';
      status.className = 'school-branding-status';
      try {
        const oldUrl = school.logo_url || '';
        const url = await uploadLogo(pendingBlob, school.id, oldUrl);
        school.logo_url = url;
        pendingBlob = null;
        input.value = '';
        preview.src = url;
        status.textContent = 'Logo saved successfully to the school cloud.';
        status.className = 'school-branding-status ok';
        renderHeader(school);
      } catch (e) {
        status.textContent = 'Logo upload failed: ' + (e.message || String(e));
        status.className = 'school-branding-status err';
        saveButton.disabled = false;
      }
    });
  }

  function install() {
    if (location.pathname.endsWith('school-management-v2.html')) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installV2);
      else installV2();
    }
  }

  window.SchoolBranding = { MAX_LOGO_BYTES, BUCKET, optimizeLogo, uploadLogo, install };
  install();
})();
