document.addEventListener('DOMContentLoaded', async () => {
  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const routes = {
    'index.html': () => import('./main.js'),
    'message.html': () => import('./message.js'),
    'map.html': () => import('./map.js'),
    
  };
  

  const loader = routes[page];
  if (!loader) {
    console.info('[UniFacens SOS] Nenhum módulo mapeado para:', page);
    return;
  }

  try {
    const module = await loader();
    if (typeof module.init === 'function') module.init();
  } catch (err) {
    console.error(`[UniFacens SOS] Erro ao carregar módulo da página (${page}):`, err);
  }
});