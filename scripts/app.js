document.addEventListener('DOMContentLoaded', async () => {

  const utils = await import('./utils.js')
  if (utils.initGlobal) utils.initGlobal()

  const page = utils.getCurrentAppRoute ? utils.getCurrentAppRoute() : 'home';

  const routes = {
    home: () => import('./home.js'),
    call: () => import('./call.js'),
    message: () => import('./message.js'),
    map: () => import('./map.js'),
  };

  const loader = routes[page] || routes.home;

  try {
    const module = await loader();
    if (typeof module.init === 'function') module.init();
  } catch (err) {
    console.error(`[UniFacens SOS] Erro ao carregar módulo da página (${page}):`, err);
  }

});