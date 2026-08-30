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

// Load the real branding UI in both V2 pages.
(() => {
  const loadBranding = () => {
    if (document.querySelector('script[data-school-branding]')) return;
    const script = document.createElement('script');
    script.src = location.pathname.endsWith('school-cloud.html') ? 'school-branding-cloud.js' : 'school-branding.js';
    script.dataset.schoolBranding = 'true';
    document.head.appendChild(script);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadBranding);
  else loadBranding();
})();
