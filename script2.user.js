// ==UserScript==
// @name         Dnevnik.ru Redirect Bypass (Overlay)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Показывает окно подтверждения поверх страницы Дневник.ру
// @author       greginator985
// @match        *://dnevnik.ru/v2/soc/moderation/abuse?link=*
// @run-at       document-end
// @grant        none
// @updateURL    https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Останавливаем выполнение других скриптов, которые могут сделать авто-редирект
    window.stop();

    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = decodeURIComponent(urlParams.get('link'));

    if (!targetUrl) return;

    // Скрываем стандартный контент страницы, чтобы он не мешался
    const bodyChildren = document.body.children;
    for (let child of bodyChildren) {
        child.style.filter = 'blur(5px)';
    }

    // Создаем стили для нашего окна
    const style = document.createElement('style');
    style.innerHTML = `
        #custom-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 1000000;
            display: flex; align-items: center; justify-content: center;
            font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            backdrop-filter: blur(2px);
        }
        #custom-modal {
            background: white; padding: 30px; border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            max-width: 500px; width: 90%; text-align: center;
            border: 1px solid #ddd;
        }
        #custom-modal h2 { margin-top: 0; color: #2c3e50; font-size: 20px; }
        #custom-modal p { color: #555; margin: 20px 0; line-height: 1.4; word-break: break-all; font-size: 16px; }
        .modal-buttons { display: flex; justify-content: center; gap: 15px; }
        .modal-btn {
            padding: 12px 30px; border: none; border-radius: 8px;
            cursor: pointer; font-weight: bold; font-size: 15px; transition: transform 0.1s, background 0.2s;
        }
        .modal-btn:active { transform: scale(0.95); }
        .btn-yes { background: #007bff; color: white; }
        .btn-yes:hover { background: #0056b3; }
        .btn-no { background: #6c757d; color: white; }
        .btn-no:hover { background: #5a6268; }
    `;
    document.head.appendChild(style);

    // Создаем элементы окна
    const overlay = document.createElement('div');
    overlay.id = 'custom-overlay';

    overlay.innerHTML = `
        <div id="custom-modal">
            <h2>Внешняя ссылка</h2>
            <p>Перейти по адресу?<br><br><strong>${targetUrl}</strong></p>
            <div class="modal-buttons">
                <button id="modal-yes" class="modal-btn btn-yes">Да (Enter)</button>
                <button id="modal-no" class="modal-btn btn-no">Нет (Esc)</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Функции управления
    const confirmMove = () => {
        window.location.href = targetUrl;
    };
    
    const cancelMove = () => {
        overlay.remove();
        // Убираем блюр с оригинального сайта, если пользователь нажал "Нет"
        for (let child of bodyChildren) {
            child.style.filter = '';
        }
        window.history.back();
    };

    // Слушатели событий
    document.getElementById('modal-yes').onclick = confirmMove;
    document.getElementById('modal-no').onclick = cancelMove;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmMove();
        } else if (e.key === 'Escape') {
            cancelMove();
        }
    });
})();
