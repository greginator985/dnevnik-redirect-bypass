// ==UserScript==
// @name         Dnevnik.ru Redirect Bypass (с подтверждением)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Показывает кастомное окно подтверждения перед переходом по ссылке
// @author       greginator985
// @match        *://dnevnik.ru/v2/soc/moderation/abuse?link=*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';

    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = decodeURIComponent(urlParams.get('link'));

    if (!targetUrl) return;

    // Создаем стили
    const style = document.createElement('style');
    style.innerHTML = `
        #custom-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            font-family: Arial, sans-serif;
        }
        #custom-modal {
            background: white; padding: 25px; border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            max-width: 450px; width: 90%; text-align: center;
        }
        #custom-modal p { color: #333; margin-bottom: 20px; line-height: 1.5; word-break: break-all; }
        .modal-btn {
            padding: 10px 25px; border: none; border-radius: 6px;
            cursor: pointer; font-weight: bold; margin: 0 10px; transition: 0.2s;
        }
        .btn-yes { background: #28a745; color: white; }
        .btn-yes:hover { background: #218838; }
        .btn-no { background: #dc3545; color: white; }
        .btn-no:hover { background: #c82333; }
    `;
    document.head.appendChild(style);

    // Создаем элементы окна
    const overlay = document.createElement('div');
    overlay.id = 'custom-overlay';

    overlay.innerHTML = `
        <div id="custom-modal">
            <p>Перейти по ссылке? <br><br><strong>${targetUrl}</strong></p>
            <button id="modal-yes" class="modal-btn btn-yes">Да (Enter)</button>
            <button id="modal-no" class="modal-btn btn-no">Нет</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Функции действий
    const confirmMove = () => window.location.replace(targetUrl);
    const cancelMove = () => {
        overlay.remove();
        window.history.back(); // Возвращаем назад в дневник
    };

    // Слушатели кликов
    document.getElementById('modal-yes').onclick = confirmMove;
    document.getElementById('modal-no').onclick = cancelMove;

    // Слушатель Enter
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            confirmMove();
        } else if (e.key === 'Escape') {
            cancelMove();
        }
    });

})();
