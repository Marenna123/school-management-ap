/* Cloud Attendance module
   Safe, isolated module for school-cloud.html. It renders into #attendanceCloudMount.
   It does not alter legacy attendance data or UI until explicitly used. */
(function(){
  const mountId='attendanceCloudMount';
  function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.AttendanceCloudModule={
    async init({supabaseClient,schoolId}){
      const mount=document.getElementById(mountId); if(!mount)return;
      if(!supabaseClient||!schoolId){mount.innerHTML='<div class="warn">Attendance cloud module is waiting for the signed-in school.</div>';return;}
      const sb=supabaseClient;
      const c=await sb.from('classes').select('id,name').eq('school_id',schoolId).eq('archived',false).order('name');
      if(c.error){mount.innerHTML='<div class="warn">Could not load classes: '+esc(c.error.message)+'</div>';return;}
      const classes=c.data||[];
      mount.innerHTML='<div class="row"><div class="field"><label>Class</label><select id="acClass">'+classes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')+'</select></div><div class="field"><label>Date</label><input id="acDate" type="date"></div><button class="btn primary" id="acLoad">Load Students</button></div><div id="acStatus" class="muted" style="margin-top:10px">Choose class and date.</div><div id="acStudents" style="margin-top:10px"></div>';
      document.getElementById('acDate').value=new Date().toISOString().slice(0,10);
      const status=document.getElementById('acStatus');
      document.getElementById('acLoad').onclick=()=>load(sb,schoolId,status);
    }
  };
  async function load(sb,schoolId,status){
    const cid=document.getElementById('acClass').value,d=document.getElementById('acDate').value;
    if(!cid||!d){status.textContent='Choose a class and date.';return;}
    const r=await sb.from('students').select('id,name,admission_no').eq('school_id',schoolId).eq('class_id',cid).eq('archived',false).order('name');
    if(r.error){status.textContent='Student load failed: '+r.error.message;return;}
    const a=await sb.from('attendance').select('student_id,status').eq('school_id',schoolId).eq('attendance_date',d);
    if(a.error){status.textContent='Attendance load failed: '+a.error.message;return;}
    const saved=Object.fromEntries((a.data||[]).map(x=>[x.student_id,x.status]));
    const list=r.data||[]; const box=document.getElementById('acStudents');
    box.innerHTML=list.length?list.map(s=>`<div class="card" style="margin:6px 0;padding:10px"><div class="row"><div class="field"><b>${esc(s.name)}</b><div class="muted">${esc(s.admission_no||'')}</div></div><select data-student="${s.id}"><option value="present" ${(saved[s.id]||'present')==='present'?'selected':''}>Present</option><option value="absent" ${saved[s.id]==='absent'?'selected':''}>Absent</option></select></div></div>`).join('')+'<button class="btn green" id="acSave">Save Attendance</button>' : '<div class="warn">No active students in this class.</div>';
    status.textContent=`Loaded ${list.length} student(s).`;
    if(list.length)document.getElementById('acSave').onclick=()=>save(sb,schoolId,status,d);
  }
  async function save(sb,schoolId,status,d){
    const rows=[...document.querySelectorAll('#acStudents select[data-student]')].map(e=>({school_id:schoolId,student_id:e.dataset.student,attendance_date:d,status:e.value}));
    if(!rows.length)return;
    const r=await sb.from('attendance').upsert(rows,{onConflict:'student_id,attendance_date'});
    status.textContent=r.error?'Save failed: '+r.error.message:'Attendance saved successfully to Supabase.';
  }
})();