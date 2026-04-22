// ==UserScript==
// @name         Dnevnik.ru Redirect Bypass
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Мгновенный переход по внешним ссылкам на Дневник.ру без подтверждения
// @author       greginator985
// @match        *://dnevnik.ru/v2/soc/moderation/abuse?link=*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/greginator985/dnevnik-redirect-bypass/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('link');
    if (targetUrl) {
        window.location.replace(decodeURIComponent(targetUrl));
    }
})();
