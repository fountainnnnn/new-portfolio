let bg = document.querySelector('#bg');
if (bg) {
    window.addEventListener('scroll', function() {
        let value = window.scrollY;
        bg.style.backgroundSize = 110 + (value + 5) + "dvh";
    })
}


const searchInput = document.getElementById('search');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        var filter = this.value.toUpperCase();
        var rows = document.querySelectorAll('#achieversTable tr');
        rows.forEach(row => {
            if (!row.cells[1]) return;
            var diploma = row.cells[1].textContent || row.cells[1].innerText;
            row.style.display = diploma.toUpperCase().indexOf(filter) > -1 ? '' : 'none';
        });
    });
}
