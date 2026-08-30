/* School Branding Add-on
 * Non-destructive helper for the existing school-cloud.html.
 * Adds direct logo selection, client-side optimization <=100 KB,
 * Supabase Storage upload, and optional header branding.
 */
(() => {
  const MAX_BYTES = 100 * 1024;
  const MAX_DIMENSION = 800;
  const BUCKET = 'school-logos';

  async function optimizeLogo(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      throw new Error('Please choose a PNG, JPG or WebP image.');
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new Error('Logo could not be compressed below 100 KB. Please choose a simpler image.');
  }

  async function uploadLogo(sb, blob, schoolId, oldUrl) {
    if (!sb || !schoolId) throw new Error('School or Supabase connection is not ready.');
    const path = `${schoolId}/${Date.now()}.webp`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp', upsert: false, cacheControl: '31536000'
    });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    const url = data.publicUrl;
    const db = await sb.from('schools').update({ logo_url: url }).eq('id', schoolId);
    if (db.error) throw db.error;

    if (oldUrl && oldUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const oldPath = oldUrl.split(marker)[1];
      if (oldPath) await sb.storage.from(BUCKET).remove([oldPath]);
    }
    return url;
  }

  function install({ sb, school, fileInputId = 'schoolLogoFile', previewId = 'schoolLogoPreview', statusId = 'schoolLogoStatus' } = {}) {
    const input = document.getElementById(fileInputId);
    if (!input) return;
    const preview = document.getElementById(previewId);
    const status = document.getElementById(statusId);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        status.textContent = 'Optimizing logo…';
        const blob = await optimizeLogo(file);
        window.__pendingSchoolLogo = blob;
        preview.src = URL.createObjectURL(blob);
        preview.style.display = 'block';
        status.textContent = `Ready • ${(blob.size / 1024).toFixed(1)} KB (maximum 100 KB)`;
      } catch (e) {
        window.__pendingSchoolLogo = null;
        input.value = '';
        preview.style.display = 'none';
        status.textContent = e.message;
      }
    });

    return {
      async save() {
        if (!window.__pendingSchoolLogo) return school?.logo_url || null;
        const url = await uploadLogo(sb, window.__pendingSchoolLogo, school.id, school.logo_url);
        school.logo_url = url;
        window.__pendingSchoolLogo = null;
        return url;
      }
    };
  }

  window.SchoolBrandingAddon = { MAX_BYTES, BUCKET, optimizeLogo, uploadLogo, install };
})();
