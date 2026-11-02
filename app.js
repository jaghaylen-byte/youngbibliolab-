
let db = { cats: [], reports: [], resources: [] };
let favorites = JSON.parse(localStorage.getItem('library_favs') || '[]');

async function init() {
    const res = await fetch('data.json');
    db = await res.json();
    setupTabs();
    renderView('home');
}

function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', 'false'));
            e.target.setAttribute('aria-selected', 'true');
            renderView(e.target.dataset.v);
        });
    });
}

function renderView(viewId) {
    const main = document.getElementById('main');
    main.innerHTML = '';
    
    if(viewId === 'home') {
        main.innerHTML = `<h2>مرحباً بكم في مكتبة صغار الباحثين</h2><p>استخدم علامات التبويب للتنقل.</p>`;
    } else if(viewId === 'reports') {
        renderReportsView(main);
    }
}

function renderReportsView(container) {
    const years = [...new Set(db.reports.map(r => r.year))].sort((a,b) => b - a);
    let html = `<h2>الأبحاث والتقارير الحقوقية حول تونس (منذ 2020)</h2>`;
    html += `<div class="filters"><button class="chip" aria-pressed="true">الكل</button></div>`;
    
    years.forEach(year => {
        html += `<div class="year-section"><h3 class="year-title">${year}</h3><div class="cards">`;
        const yearReports = db.reports.filter(r => r.year === year);
        yearReports.forEach(rep => {
            const isFav = favorites.includes(rep.id) ? 'active' : '';
            html += `
            <div class="card">
                <div style="display:flex; justify-content:space-between;">
                    <h3><a href="${rep.url_pdf}" target="_blank">${rep.title}</a></h3>
                    <button class="fav-btn ${isFav}" onclick="toggleFav('${rep.id}')">★</button>
                </div>
                <p><strong>${rep.org}</strong> - ${rep.date}</p>
                <p>${rep.abstract}</p>
                <div class="actions-row">
                    <button class="btn-sm" onclick="copyCitation('${rep.id}', 'chicago')">اقتباس (Chicago)</button>
                    <a href="${rep.url_org}" target="_blank" class="btn-sm">المصدر الأصلي</a>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
}

window.toggleFav = function(id) {
    if(favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('library_favs', JSON.stringify(favorites));
    renderView('reports'); // re-render to update UI
};

window.copyCitation = function(id, format) {
    const rep = db.reports.find(r => r.id === id);
    let text = `${rep.org}, "${rep.title}," ${rep.year}.`;
    navigator.clipboard.writeText(text);
    alert('تم نسخ الإحالة!');
};

document.addEventListener('DOMContentLoaded', init);
