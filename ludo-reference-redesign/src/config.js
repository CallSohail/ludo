export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  siteUsername: import.meta.env.VITE_SITE_USERNAME || 'ludoguys',
  siteAuthEmail:
    import.meta.env.VITE_SITE_AUTH_EMAIL || 'sohail.cs951+ludoguys@gmail.com',
  sohailFontUrl:
    import.meta.env.VITE_SOHAIL_FONT_URL ||
    'https://cdn.jsdelivr.net/gh/YOUR-USERNAME/sohail-hand@v1.0/SohailHand-Regular.woff2',
  demoUsername: import.meta.env.VITE_DEMO_ADMIN_USERNAME || 'admin',
  demoPassword: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'ludo2026',
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseKey);

export const palette = [
  '#f5b700',
  '#2374ab',
  '#22c77a',
  '#ff791f',
  '#12b3bd',
  '#4b75d1',
  '#9a5cc7',
  '#e94b45',
  '#e91e63',
  '#159f8e',
];

export const emojis = ['🎲', '🔥', '👑', '🦥', '🚀', '🧠', '🍀', '🕺', '🧨', '🐉', '🦄', '😎'];

export const recognition = [
  { label: 'Board Boss', icon: '👑', color: 'gold' },
  { label: 'Dice Royalty', icon: '🎲', color: 'blue' },
  { label: 'Bronze Legend', icon: '🥉', color: 'coral' },
  { label: 'Dangerous Dice', icon: '🧨', color: 'pink' },
  { label: 'Plot Twist', icon: '🌀', color: 'green' },
  { label: 'Quiet Assassin', icon: '🥷', color: 'purple' },
  { label: 'Almost Famous', icon: '🌟', color: 'orange' },
  { label: 'Still Loading', icon: '⏳', color: 'teal' },
  { label: 'Lucky Maybe', icon: '🍀', color: 'blue' },
  { label: 'Wildcard', icon: '🃏', color: 'coral' },
];
