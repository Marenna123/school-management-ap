// Cloud sync helper for School Management V2.
(function(){
  const CONFIG = window.SUPABASE_CONFIG || {};
  if (!CONFIG.url || !CONFIG.key) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = function(){
    window.schoolSupabase = window.supabase.createClient(CONFIG.url, CONFIG.key);
    window.schoolCloud = {
      async user(){ const r=await window.schoolSupabase.auth.getUser(); return r.data.user||null; },
      async loadSchool(){ const u=await this.user(); if(!u)return {data:null,error:null}; return window.schoolSupabase.from('schools').select('*').eq('owner_id',u.id).limit(1).maybeSingle(); },
      async saveSchool(data){ const u=await this.user(); if(!u)return {data:null,error:new Error('Please sign in first.')}; return window.schoolSupabase.from('schools').upsert({...data,owner_id:u.id},{onConflict:'owner_id'}).select().single(); },
      async syncFoundation(db){
        const u=await this.user(); if(!u)return {data:null,error:new Error('Please sign in first.')};
        let school=await this.loadSchool(); if(school.error)return school;
        if(!school.data){ school=await this.saveSchool({name:db.school||'',academic_year:db.year||'',address:''}); if(school.error)return school; }
        const schoolId=school.data.id;
        for(const c of (db.classes||[])){
          const cr=await window.schoolSupabase.from('classes').upsert({school_id:schoolId,name:c.name,archived:!!c.archived},{onConflict:'school_id,name'}).select().single(); if(cr.error)return cr;
          for(const s of (c.sections||[])){ const sr=await window.schoolSupabase.from('sections').upsert({class_id:cr.data.id,name:typeof s==='string'?s:s.name,archived:typeof s==='string'?false:!!s.archived},{onConflict:'class_id,name'}); if(sr.error)return sr; }
          for(const subject of (c.subjects||[])){ const rr=await window.schoolSupabase.from('subjects').upsert({class_id:cr.data.id,name:subject},{onConflict:'class_id,name'}); if(rr.error)return rr; }
        }
        return {data:{schoolId},error:null};
      }
    };
    window.dispatchEvent(new Event('school-cloud-ready'));
  };
  document.head.appendChild(script);
})();
