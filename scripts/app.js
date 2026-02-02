document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop();

    switch (page) {
        case 'index.html':
            import('./main.js')
            .then(module => {
                if (typeof module.init === 'function') {
                module.init();
                }
            })
        .catch(err => console.error('Erro ao carregar main.js:', err));
        break;

        default:
            console.log('Nenhum módulo carregado para esta página:', page);
    }

    // import('./utils.js')
    // .then(utils => {
    //     if (typeof utils.init === 'function') {
    //         utils.init();
    //     }
    // })
    // .catch(err => console.error('Erro ao carregar utils.js:', err));
});