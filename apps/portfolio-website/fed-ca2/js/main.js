//reveal on scroll animation:

//once scrolled, call in revealanimation()
window.addEventListener('scroll', revealanimation);

//the fancy scroll reveal animations
function revealanimation() {
    var revealsTop = document.querySelectorAll('.revealTop');
    var windowHeight = window.innerHeight; //height of the content window
    var revealpoint = 70;

    for (let i = 0; i < revealsTop.length; i++) {

        var revealTop = revealsTop[i].getBoundingClientRect().top //to get the position thingy 

        if (revealTop < windowHeight - revealpoint) {
            //add class='active' if the position of the elements reach the reveal point i think..
            revealsTop[i].classList.add ('activeTop')
        }
        else {
            //remove if out of reach
            revealsTop[i].classList.remove('activeTop');
        }
    }

    var revealsLeft = document.querySelectorAll('.revealLeft');

    for (let i = 0; i < revealsLeft.length; i++) {
        var revealLeft = revealsLeft[i].getBoundingClientRect().top;

        if (revealLeft < windowHeight - revealpoint) {
            revealsLeft[i].classList.add ('activeLeft');
        }
        else {
            revealsLeft[i].classList.remove('activeLeft');
        }
    }

    var revealsRight = document.querySelectorAll('.revealRight');

    for (let i = 0; i < revealsRight.length; i++) {
        var revealRight = revealsRight[i].getBoundingClientRect().top;

        if (revealRight < windowHeight - revealpoint) {
            revealsRight[i].classList.add ('activeRight');
        }
        else {
            revealsRight[i].classList.remove('activeRight');
        }
    }

}

//back to top button
window.onscroll = function() {
    let button = document.getElementById('backToTop');
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
        button.style.display = 'block';
    } else {
        button.style.display = 'none';
    }
};

document.getElementById('backToTop').onclick = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};


//quote
document.addEventListener('DOMContentLoaded', (event) => {
    const toastElement = document.getElementById('quote-toast');
    const toastBody = toastElement.querySelector('.toast-body');
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 4500 });

    const quotes = [
        { content: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
        { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { content: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats" },
        { content: "Whether you think you can, or you think you can't – you're right.", author: "Henry Ford" },
        { content: "The best way to predict the future is to invent it.", author: "Alan Kay" }
    ];

    function getRandomQuote() {
        const randomIndex = Math.floor(Math.random() * quotes.length);
        return quotes[randomIndex];
    }

    function displayQuote() {
        const quote = getRandomQuote();
        toastBody.innerHTML = `<p>${quote.content}</p><footer class="blockquote-footer">${quote.author}</footer>`;
        if (!toastElement.classList.contains('show')) {
            toast.show();
        }
    }

    setTimeout(displayQuote, 300);
    window.addEventListener('scroll', () => toast.hide(), { passive: true });
});
