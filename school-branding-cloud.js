/* School Branding UI for the existing cloud app. */
(() => {
  const MAX_BYTES = 100 * 1024;
  const MAX_DIMENSION = 800;
  const BUCKET = 'school-logos';
  const optimize = file => new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Please choose a PNG, JPG or WebP image.'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const qs = [0.9,0.8,0.7,0.6,0.5,0.4]; let i=0;
        const next=()=>canvas.toBlob(blob=>{
          if(!blob)return reject(new Error('Could not optimize the logo.'));
          if(blob.size<=MAX_BYTES||i===qs.length-1){
            if(blob.size>MAX_BYTES)return reject(new Error('Logo could not be reduced below 100 KB.'));
            resolve(blob); return;
          }
          i++; next();
        },'image/webp',qs[i]); next();
      };
      img.onerror=()=>reject(new Error('Could not read the image.')); img.src=reader.result;
    };
    reader.onerror=()=>reject(new Error('Could not read the image.')); reader.readAsDataURL(file);
  });

  async function install(){
    const structure=document.getElementById('structure');
    if(!structure||document.getElementById('schoolBrandingCard'))return;
    const card=document.createElement('div'); card.id='schoolBrandingCard'; card.className='card';
    card.innerHTML=`<h3>🎨 School Branding</h3><p class="muted">Upload your school's logo. It is optimized automatically and saved to the school cloud.</p><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><input id="brandingFile" type="file" accept="image/png,image/jpeg,image/webp"><img id="brandingPreview" alt="School logo preview" style="display:none;width:90px;height:90px;object-fit:contain;border:1px dashed #94a3b8;border-radius:10px;padding:4px"></div><div id="brandingStatus" class="muted" style="margin-top:10px">Choose a logo to begin.</div><button id="brandingSave" class="btn green" type="button">💾 Save School Logo</button>`;
    structure.insertBefore(card,structure.firstElementChild);
    const input=document.getElementById('brandingFile'), preview=document.getElementById('brandingPreview'), status=document.getElementById('brandingStatus'), save=document.getElementById('brandingSave');
    let pending=null,oldUrl='';
    try{
      const client=supabase.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.key);
      const a=await client.auth.getUser(); if(!a.data.user){status.textContent='Please sign in to manage school branding.';return;}
      const s=await client.from('schools').select('id,logo_url').eq('owner_id',a.data.user.id).maybeSingle();
      if(s.error)throw s.error; if(!s.data)throw new Error('No school record found for this account.');
      oldUrl=s.data.logo_url||''; if(oldUrl){preview.src=oldUrl;preview.style.display='block';status.textContent='Current school logo loaded.';}
      input.onchange=async()=>{try{pending=await optimize(input.files&&input.files[0]);preview.src=URL.createObjectURL(pending);preview.style.display='block';status.textContent=`Ready • ${(pending.size/1024).toFixed(1)} KB`;}catch(e){pending=null;status.textContent=e.message;}};
      save.onclick=async()=>{if(!pending)return alert('Please choose a logo first.');save.disabled=true;try{
        status.textContent='Uploading school logo…'; const now=await client.auth.getUser();
        const row=await client.from('schools').select('id,logo_url').eq('owner_id',now.data.user.id).maybeSingle(); if(row.error)throw row.error; if(!row.data)throw new Error('No school record found.');
        oldUrl=row.data.logo_url||oldUrl; const path=`${row.data.id}/${Date.now()}.webp`;
        const up=await client.storage.from(BUCKET).upload(path,pending,{contentType:'image/webp',upsert:false,cacheControl:'31536000'}); if(up.error)throw up.error;
        const url=client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; const db=await client.from('schools').update({logo_url:url}).eq('id',row.data.id); if(db.error)throw db.error;
        if(oldUrl&&oldUrl.includes(`/storage/v1/object/public/${BUCKET}/`)){const marker=`/storage/v1/object/public/${BUCKET}/`;const oldPath=oldUrl.split(marker)[1];if(oldPath&&oldPath!==path)await client.storage.from(BUCKET).remove([oldPath]);}
        oldUrl=url;preview.src=url;preview.style.display='block';status.textContent='✓ School logo saved successfully to the cloud.';input.value='';pending=null;
      }catch(e){status.textContent='Save failed: '+(e.message||e);}finally{save.disabled=false;}};
    }catch(e){status.textContent='Branding could not initialize: '+(e.message||e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
