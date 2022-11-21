/* eslint-disable max-len */
/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku
// @namespace    https://muted.top/
// @version      0.6.0
// @description  yhdm, but with Danmaku from Bilibili
// @author       MUTED64
// @match        *://*.yhdmp.cc/vp/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.bilibili.com
// @icon         https://www.yhdmp.cc/yxsf/yh_pic/favicon.ico
// @require      https://bowercdn.net/c/danmaku-2.0.4/dist/danmaku.dom.min.js
// @require      https://greasyfork.org/scripts/454443-sakuradanmakuclasses/code/SakuraDanmakuClasses.js?version=1119504
// @run-at       document-end
// ==/UserScript==

"use strict";

async function loadDanmaku() {
  const keyword = document
    .querySelector("title")
    .textContent.replace(/ 第[0-9]+集.*/gi, "")
    .replace(/ Part ?[0-9]+.*/, "");
  const episode = Number(
    document
      .querySelector("body div.gohome > span")
      .textContent.replace(/[^0-9]+/gi, "")
  );

  const iframeDocument = iframe.contentWindow.document;
  const container = iframeDocument.querySelector("div.dplayer-video-wrap");
  const video = iframeDocument.querySelector("div.dplayer-video-wrap > video");
  const iconsBar = iframeDocument.querySelector(
    "div.dplayer-controller > div.dplayer-icons.dplayer-icons-right"
  );

  const danmakuLoader = new DanmakuLoader(keyword, episode, container, video);
  await danmakuLoader.showDanmaku();
  const danmakuDOM = danmakuLoader.container.lastElementChild;
  new DanmakuSettings(danmakuLoader, danmakuDOM, iconsBar, iframeDocument);
}

const iframe = document.querySelector("iframe");
iframe.onload = loadDanmaku;
