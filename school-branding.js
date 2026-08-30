/* School branding + logo upload module
 * Keeps school identity in the existing `schools` row and stores an optimized
 * logo in Supabase Storage. UI can load this module from school-cloud.html.
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

          // Start with WebP for compact logos; progressively lower quality until <=100 KB.
          const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
          let i = 0;
          const next = () => canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Could not optimize the logo.'));
            if (blob.size <= MAX_LOGO_BYTES || i === qualities.length - 1) {
              if (blob.size > MAX_LOGO_BYTES) return reject(new Error('This logo could not be compressed below 100 KB. Please choose a simpler image.'));
              resolve(blob);
              return;
            }
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

  async function uploadLogo(file, schoolId, oldUrl) {
    const client = getClient();
    if (!client) throw new Error('Supabase is not ready.');
    if (!schoolId) throw new Error('School record is not ready.');

    const blob = await optimizeLogo(file);
    const path = `${schoolId}/${Date.now()}.webp`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '31536000'
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(path);
    const logoUrl = publicData.publicUrl;
    const { error: dbError } = await client.from('schools').update({ logo_url: logoUrl }).eq('id', schoolId);
    if (dbError) throw dbError;

    // Remove the previous object when it belongs to our bucket.
    if (oldUrl && oldUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const oldPath = oldUrl.split(marker)[1];
      if (oldPath) await client.storage.from(BUCKET).remove([oldPath]);
    }
    return logoUrl;
  }

  function install() {
    const input = document.getElementById('schoolLogoFile');
    if (!input) return;
    const preview = document.getElementById('schoolLogoPreview');
    const status = document.getElementById('schoolLogoStatus');
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        status.textContent = 'Optimizing logo…';
        const blob = await optimizeLogo(file);
        const url = URL.createObjectURL(blob);
        preview.src = url;
        preview.style.display = 'block';
        status.textContent = `Ready • ${(blob.size / 1024).toFixed(1)} KB`;
        window.__schoolLogoBlob = blob;
      } catch (e) {
        input.value = '';
        preview.removeAttribute('src');
        preview.style.display = 'none';
        status.textContent = e.message;
      }
    });
  }

  window.SchoolBranding = { MAX_LOGO_BYTES, BUCKET, optimizeLogo, uploadLogo, install };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
