// ==UserScript==
// @name         Dnevnik.ru Redirect Bypass (Direct Overlay)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Показывает окно подтверждения прямо при клике по ссылке в ленте
// @author       greginator985
// @match        *://dnevnik.ru/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Создаем стили заранее
    const style = document.createElement('style');
    style.innerHTML = `
        #custom-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 1000000;
            display: flex; align-items: center; justify-content: center;
            font-family: "Segoe UI", Roboto, sans-serif;
            backdrop-filter: blur(4px);
        }
        #custom-modal {
            background: white; padding: 30px; border-radius: 15px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            max-width: 500px; width: 90%; text-align: center;
            animation: modalShow 0.2s ease-out;
        }
        @keyframes modalShow { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        #custom-modal p { color: #333; margin: 20px 0; word-break: break-all; font-size: 16px; line-height: 1.4; }
        .modal-buttons { display: flex; justify-content: center; gap: 15px; }
        .modal-btn {
            padding: 12px 30px; border: none; border-radius: 8px;
            cursor: pointer; font-weight: bold; font-size: 15px; transition: 0.2s;
        }
        .btn-yes { background: #007bff; color: white; }
        .btn-yes:hover { background: #0056b3; }
        .btn-no { background: #6c757d; color: white; }
        .btn-no:hover { background: #5a6268; }
    `;

    let activeOverlay = null;
    let targetUrl = '';

    const showModal = (url) => {
        targetUrl = url;
        if (!document.head || !document.body) return;
        
        if (!document.getElementById('custom-style')) {
            style.id = 'custom-style';
            document.head.appendChild(style);
        }

        activeOverlay = document.createElement('div');
        activeOverlay.id = 'custom-overlay';
        activeOverlay.innerHTML = `
            <div id="custom-modal">
                <p>Перейти по ссылке?<br><br><strong>${targetUrl}</strong></p>
                <div class="modal-buttons">
                    <button id="modal-yes" class="modal-btn btn-yes">Да (Enter)</button>
                    <button id="modal-no" class="modal-btn btn-no">Нет (Esc)</button>
                </div>
            </div>
        `;
        document.body.appendChild(activeOverlay);

        document.getElementById('modal-yes').onclick = () => window.open(targetUrl, '_blank');
        document.getElementById('modal-no').onclick = closeModal;
    };

    const closeModal = () => {
        if (activeOverlay) {
            activeOverlay.remove();
            activeOverlay = null;
        }
    };

    // Глобальный перехват кликов
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.href.includes('dnevnik.ru/v2/soc/moderation/abuse?link=')) {
            e.preventDefault();
            e.stopPropagation();
            
            const rawUrl = new URL(link.href).searchParams.get('link');
            showModal(decodeURIComponent(rawUrl));
        }
    }, true);

    // Обработка клавиатуры
    window.addEventListener('keydown', (e) => {
        if (!activeOverlay) return;
        if (e.key === 'Enter') {
            window.open(targetUrl, '_blank');
            closeModal();
        } else if (e.key === 'Escape') {
            closeModal();
        }
    });
})();
