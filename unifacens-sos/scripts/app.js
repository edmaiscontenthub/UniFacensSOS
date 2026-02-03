/**
 * Router simples por página.
 * Importante: este arquivo é carregado como type="module" no HTML.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const routes = {
    'index.html': () => import('./main.js'),
    'massage.html': () => import('./message.js'),
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