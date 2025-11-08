// Добавляем динамические блики при движении мыши
document.querySelectorAll('.liquid-glass').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
        
        const intensity = 1 - (distance / maxDistance);
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
        card.style.setProperty('--light-intensity', intensity);
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.removeProperty('--mouse-x');
        card.style.removeProperty('--mouse-y');
        card.style.removeProperty('--light-intensity');
    });
});


document.querySelectorAll('.liquid-glass').forEach(card => {
    const reflections = card.querySelector('.liquid-reflections');
    
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        reflections.style.background = `radial-gradient(circle at ${x}% ${y}%, 
            rgba(255, 255, 255, 0.2) 0%, 
            rgba(255, 255, 255, 0.1) 30%, 
            transparent 70%)`;
    });
    
    card.addEventListener('mouseleave', () => {
        reflections.style.background = '';
    });
});

function reloadStylesheets() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
        const href = link.href;
        link.href = '';
        link.href = href;
    });
}

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        setTimeout(() => {
            document.querySelectorAll('.action-card.liquid-glass').forEach(card => {
                const parent = card.parentNode;
                const clone = card.cloneNode(true);
                parent.replaceChild(clone, card);
            });
        }, 50);
    }
});
