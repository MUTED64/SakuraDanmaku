/* eslint-disable max-len */
/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku
// @namespace    https://muted.top/
// @version      0.4
// @description  yhdm, but with Danmaku from Bilibili
// @author       MUTED64
// @match        https://www.yhdmp.cc/vp/*
// @grant        GM_xmlhttpRequest
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yhdmp.cc
// @require      https://bowercdn.net/c/danmaku-2.0.4/dist/danmaku.dom.min.js
// @require https://greasyfork.org/scripts/454443-sakuradanmakuclasses/code/SakuraDanmakuClasses.js?version=1114685
// ==/UserScript==

"use strict";

async function loadDanmaku() {
  const episode_url = "https://www.bilibili.com/bangumi/play/ep693247";
  const episode = 2;
  const iframeDocument = iframe.contentWindow.document;
  const container = iframeDocument.querySelector("#player1 > div.dplayer-video-wrap");
  const video = iframeDocument.querySelector("#player1 > div.dplayer-video-wrap > video");
  const iconsBar = iframeDocument.querySelector("div.dplayer-controller > div.dplayer-icons.dplayer-icons-right");
  const danmakuLoader = new DanmakuLoader(
    episode_url,
    episode,
    container,
    video
  );
  await danmakuLoader.showDanmaku();
  const danmakuDOM = danmakuLoader.container.lastElementChild;
  new DanmakuSettings(danmakuLoader, danmakuDOM, iconsBar, iframeDocument);
}

const iframe = document.querySelector("iframe#yh_playfram");
iframe.onload = loadDanmaku;
