window.SUPABASE_CONFIG = {
  url: 'https://ypzdhavmpxjocmlbriqk.supabase.co',
  key: 'sb_publishable_XHqKUARz_VfYCsG0hKW-0w_AT0sUprz'
};

// Compatibility fix for optional UUID fields used by the cloud school app.
// Supabase UUID columns must receive null (not an empty string) when no section is selected.
(() => {
  const originalCreateClient = supabase.createClient;
  supabase.createClient = function (...args) {
    const client = originalCreateClient.apply(this, args);
    const originalFrom = client.from.bind(client);

    client.from = function (table) {
      const builder = originalFrom(table);
      if (table === 'students' && typeof builder.insert === 'function') {
        const originalInsert = builder.insert.bind(builder);
        builder.insert = function (values, ...rest) {
          const normalize = (value) => {
            if (Array.isArray(value)) return value.map(normalize);
            if (value && typeof value === 'object') {
              const copy = { ...value };
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
