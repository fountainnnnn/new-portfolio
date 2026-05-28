(function () {
    'use strict';

    // Function to validate form fields
    function validateForm(form) {
        let isValid = true;

        const nameField = form.querySelector('#usernameField');
        if (nameField.value.trim() === "") {
            isValid = false;
            nameField.classList.add("is-invalid");
        } else {
            nameField.classList.remove("is-invalid");
        }
        const emailUsername = form.querySelector('input[placeholder="Email Username"]');
        const emailDomain = form.querySelector('input[placeholder="gmail.com"]');
        const emailField = `${emailUsername.value}@${emailDomain.value}`;
        if (!validateEmail(emailField)) {
            isValid = false;
            emailUsername.classList.add("is-invalid");
            emailDomain.classList.add("is-invalid");
        } else {
            emailUsername.classList.remove("is-invalid");
            emailDomain.classList.remove("is-invalid");
        }

        const phoneField = form.querySelector('#passwordField');
        if (!validatePhoneNumber(phoneField.value)) {
            isValid = false;
            phoneField.classList.add("is-invalid");
        } else {
            phoneField.classList.remove("is-invalid");
        }

        const dobField = form.querySelector('#dobField');
        if (dobField.value === "") {
            isValid = false;
            dobField.classList.add("is-invalid");
        } else {
            dobField.classList.remove("is-invalid");
        }

        const knowledgeRadios = form.querySelectorAll('input[name="btnradio"]');
        if (![...knowledgeRadios].some(radio => radio.checked)) {
            isValid = false;
            knowledgeRadios.forEach(radio => radio.classList.add("is-invalid"));
        } else {
            knowledgeRadios.forEach(radio => radio.classList.remove("is-invalid"));
        }

        const eventRadios = form.querySelectorAll('input[name="options-outlined"]');
        if (![...eventRadios].some(radio => radio.checked)) {
            isValid = false;
            eventRadios.forEach(radio => radio.classList.add("is-invalid"));
        } else {
            eventRadios.forEach(radio => radio.classList.remove("is-invalid"));
        }

        const termsField = form.querySelector('#termsField');
        if (!termsField.checked) {
            isValid = false;
            termsField.classList.add("is-invalid");
        } else {
            termsField.classList.remove("is-invalid");
        }

        if (!isValid) {
            scrollToFirstInvalidField(form);
        }

        return isValid;
    }

    // Function to validate email format
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    // Function to validate phone number format
    function validatePhoneNumber(phone) {
        const re = /^[689]\d{7}$/;
        return re.test(phone);
    }

    // Function to scroll to the first invalid field
    function scrollToFirstInvalidField(form) {
        const firstInvalidField = form.querySelector('.is-invalid');
        if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidField.focus();
        }
    }

    // Array to hold wishes
    const wishes = [
        { username: 'Alex', message: 'Happy 70th Anniversary Singapore Poly!', timestamp: new Date().toLocaleString() },
        { username: 'Mervin Ng', message: 'Singapore Polytechnic best poly fr fr', timestamp: new Date().toLocaleString() },
        { username: 'JayYing', message: 'happy 70th bday sp!! wit sp its so possible 😁', timestamp: new Date().toLocaleString() }
    ];

    // Array to hold images
    const images = [];

    // Function to add a wish to the wish wall
    function addWishToWall(wish) {
        const wishDiv = document.createElement('div');
        wishDiv.className = 'card col-11 col-md-3 mb-2 revealTop hover';
        wishDiv.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${wish.username}</h5>
                <p class="card-text">${wish.message}</p>
                <p class="card-text"><small class="text-muted">${wish.timestamp}</small></p>
            </div>
        `;
        document.getElementById('wishWall').appendChild(wishDiv);
    }

    // Function to add an image to the memories gallery
    function addImageToGallery(image) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'card col-11 col-sm-3 mb-2 revealTop hover'; // Ensure images stack properly
        imageDiv.innerHTML = `
            <img src="${image.src}" class="card-img-top img-thumbnail" alt="Uploaded Image">
            <figcaption class="card-body">
                <p class="card-text"><small class="text-muted">Uploaded by ${image.uploader} at ${image.timestamp}</small></p>
            </figcaption>
        `;
        document.getElementById('memoriesGallery').appendChild(imageDiv);
    }

    // Add dummy wishes to the wall on page load
    document.addEventListener('DOMContentLoaded', () => {
        wishes.forEach(addWishToWall);
    });

    // Handle form submission
    document.getElementById('feedbackForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const form = event.target;
        const isValid = validateForm(form);

        if (isValid) {
            const username = document.getElementById('usernameField').value.trim();
            const wishMessage = document.getElementById('exampleFormControlTextarea1').value.trim();
            const imageInput = document.getElementById('imageInput');

            if (username !== '' && wishMessage !== '') {
                const wish = {
                    username: username,
                    message: wishMessage,
                    timestamp: new Date().toLocaleString()
                };
                
                wishes.push(wish);
                addWishToWall(wish);

                // Handle image upload
                if (imageInput.files && imageInput.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const image = {
                            src: e.target.result,
                            uploader: username,
                            timestamp: new Date().toLocaleString()
                        };

                        images.push(image); // Add to images array
                        addImageToGallery(image);
                    };
                    reader.readAsDataURL(imageInput.files[0]);
                }
                // Reset the form
                form.reset();
                form.classList.remove('was-validated');
                const modal = new bootstrap.Modal(document.getElementById('successModal'));
                modal.show();

                // Clear the image input
                imageInput.value = '';
            } else {
                alert('Please enter your name and a wish/message.');
            }
        }
    });

})();
