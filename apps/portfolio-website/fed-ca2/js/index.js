var ground = document.getElementById('ground');
var humans = document.getElementById('humans');
var SPFullLogo = document.getElementById('SP70FullLogo')

// parallax effect variables (bottom)
if (ground && humans && SPFullLogo) {
    window.addEventListener('scroll', () => {
        var value = window.scrollY;

        humans.style.transform = `translateX(${value * 0.175}px)`;
        ground.style.marginLeft = value * -0.05 + 'px';
        SPFullLogo.style.marginTop = value * 1.5 + 'px';
    });
}

function setParallaxHeights() {
    // set the height of the element based on how tall the parallax image is
    var parallax2Elements = document.querySelectorAll('.parallax2');
    var groundImage = document.getElementById('ground');

    if (groundImage) {
        var groundHeight = groundImage.clientHeight; // Get the current height of the image

        parallax2Elements.forEach(element => {
            element.style.height = groundHeight - 3 + 'px';
        });
    }
}
setParallaxHeights();

// Listen for window size adjustment
window.addEventListener('resize', setParallaxHeights);


//see more button
document.addEventListener('DOMContentLoaded', function () {
    
    var toggleLinks = document.getElementsByClassName('toggleLink');
    var moreContents = document.getElementsByClassName('more-content');

    for (let i = 0; i < toggleLinks.length; i++) {
        toggleLinks[i].addEventListener('click', function (event) {
            if (moreContents[i].style.display === 'none') {
                moreContents[i].style.display = 'block';
                toggleLinks[i].textContent = 'Read less...';
            } else {
                moreContents[i].style.display = 'none';
                toggleLinks[i].textContent = 'Read more...';
            }
        });
        moreContents[i].style.display = 'none';
    }
});


let correctAnswers = 0; // Variable to collect the number of correct answers
let currentQuestion = 1;
const totalQuestions = document.querySelectorAll('.question').length;

document.addEventListener('DOMContentLoaded', (event) => {
    document.querySelectorAll('.option-btn').forEach(button => {
        button.addEventListener('click', function() {
            const question = this.getAttribute('data-question');
            const value = parseInt(this.getAttribute('data-value'));
            const isCorrect = value === 1;

            // Set button color based on correct or not
            this.classList.remove('btn-outline-primary');
            this.classList.add(isCorrect ? 'btn-success' : 'btn-danger');

            // Disable all buttons for this question and style them
            document.querySelectorAll(`.option-btn[data-question="${question}"]`).forEach(btn => {
                btn.disabled = true;
                btn.classList.remove('btn-outline-primary');
                btn.classList.add(parseInt(btn.getAttribute('data-value')) === 1 ? 'btn-success' : 'btn-danger');
            });

            // Update the correct answers count
            if (isCorrect) {
                correctAnswers++;
            }

            // Move to next question after 800ms
            setTimeout(() => {
                if (parseInt(question) < totalQuestions) {
                    nextQuestion(parseInt(question));
                } else {
                    submitQuiz();
                }
            }, 800);
        });
    });
});

function startQuiz() {
    if (!document.getElementById('start-page')) return;
    document.getElementById('start-page').style.display = 'none';
    document.getElementById('quiz-container').classList.remove('d-none');
    document.getElementById('quiz-form').classList.add('active');
    updateProgressBar(); 
}

function nextQuestion(current) {
    document.getElementById(`question${current}`).classList.remove('active');
    document.getElementById(`question${current + 1}`).classList.add('active');
    currentQuestion++;
    updateProgressBar();
}

function submitQuiz() {
    if (!document.getElementById('quiz-form')) return;
    document.getElementById('quiz-form').classList.remove('active');

    
    document.getElementById('score').innerText = `Your score is: ${correctAnswers}/${totalQuestions}`;

    
    const myModal = new bootstrap.Modal(document.getElementById('exampleModal'));
    myModal.show();

    // Update progress bar once finished quiz
    updateProgressBar(true);

    // Show the restart button on the trivia page
    document.querySelector('.restart').classList.remove('d-none');
}

function restartQuiz() {
    if (!document.getElementById('quiz-container')) return;
    document.getElementById('quiz-container').classList.add('d-none');
    document.getElementById('start-page').style.display = 'block';

    // Reset form
    correctAnswers = 0; 
    currentQuestion = 1; 
    updateProgressBar(); // Reset the progress bar
    document.getElementById('score').innerText = '';
    document.querySelectorAll('.option-btn').forEach(button => {
        button.classList.remove('btn-success', 'btn-danger');
        button.classList.add('btn-outline-primary');
        button.disabled = false;
    });
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.getElementById('question1').classList.add('active');

    // Hide the restart button on the trivia page
    document.querySelector('.restart').classList.add('d-none');
}

function updateProgressBar(isQuizCompleted = false) {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar || totalQuestions === 0) return;
    if (isQuizCompleted) {
        progressBar.style.width = '100%';
        progressBar.setAttribute('aria-valuenow', '100');
    } else {
        const progressPercentage = ((currentQuestion - 1) / totalQuestions) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute('aria-valuenow', progressPercentage);
    }
}

function showModal() {
    var startPopup = document.getElementById('startpopup');
    if (!startPopup || typeof bootstrap === 'undefined') return;
    var myModal = new bootstrap.Modal(startPopup);
    myModal.show();
}

// show the popup after 500ms
setTimeout(showModal, 500);
