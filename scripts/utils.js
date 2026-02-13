// document.querySelectorAll('.btn').forEach(btn => {
//     const img = btn.querySelector(':scope > img')
//     if (!img) return

//     const original = img.src
//     const hover = original.replace('.svg', '-hover.svg')

//     const preload = new Image()
//     preload.src = hover

//     btn.addEventListener('mouseenter', () => img.src = hover)
//     btn.addEventListener('mouseleave', () => img.src = original)
// })