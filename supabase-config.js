window.SUPABASE_CONFIG = {
  url: 'https://ypzdhavmpxjocmlbriqk.supabase.co',
  key: 'sb_publishable_XHqKUARz_VfYCsG0hKW-0w_AT0sUprz'
};

// Compatibility fix for optional UUID fields used by the cloud school app.
(() => {
  const originalCreateClient = supabase.createClient;
  supabase.createClient = function (...args) {
    const client = originalCreateClient.apply(this, args);
    const originalFrom = client.from.bind(client);
    client.from = function (table) {
      const builder = originalFrom(table);
      if ((table === 'students' || table === 'teachers') && typeof builder.insert === 'function') {
        const originalInsert = builder.insert.bind(builder);
        builder.insert = function (values, ...rest) {
          const normalize = (value) => {
            if (Array.isArray(value)) return value.map(normalize);
            if (value && typeof value === 'object') {
              const copy = { ...value };
              if (copy.class_id === '') copy.class_id = null;
              if (copy.section_id === '') copy.section_id = null;
              return copy;
            }
            return value;
          };
          return originalInsert(normalize(values), ...rest);
        };
      }
      return builder;
    };
    return client;
  };
})();

// School Management V2 branding.
if (location.pathname.endsWith('school-management-v2.html')) {
  const loadBranding = () => {
    if (document.querySelector('script[data-school-branding]')) return;
    const script = document.createElement('script');
    script.src = 'school-branding.js?v=20260830';
    script.dataset.schoolBranding = 'true';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadBranding);
  else loadBranding();
}

// Live V2 cloud attendance. The V2 page already contains the Attendance tab,
// so load the dedicated V2 module there and replace only that section.
if (location.pathname.endsWith('school-management-v2.html')) {
  const loadV2Attendance = () => {
    if (!document.getElementById('attendance')) return;
    if (document.querySelector('script[data-v2-cloud-attendance]')) return;
    const script = document.createElement('script');
    script.src = 'attendance-v2-cloud.js?v=20260830';
    script.dataset.v2CloudAttendance = 'true';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadV2Attendance);
  else loadV2Attendance();
}

// School Management Cloud attendance.
// Load by cache-busted URL and whenever the page actually contains the attendance section.
if (location.pathname.endsWith('school-cloud.html')) {
  const loadCloudAttendance = () => {
    if (!document.getElementById('attendance')) return;
    if (document.querySelector('script[data-cloud-attendance]')) return;
    const script = document.createElement('script');
    script.src = 'attendance-cloud.js?v=20260830';
    script.dataset.cloudAttendance = 'true';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadCloudAttendance);
  else loadCloudAttendance();
}
