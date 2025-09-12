window.addEventListener('scroll', () => {
    document.querySelectorAll('.archive-item').forEach(item => {
        const itemPosition = item.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (itemPosition < windowHeight && itemPosition > 0) {
            let scale = (itemPosition / windowHeight);
            scale = scale < 0.8 ? 0.8 : scale; // Ensure scale doesn't go below 0.8
            item.style.transform = `scale(${scale})`;
        }
    });
});
