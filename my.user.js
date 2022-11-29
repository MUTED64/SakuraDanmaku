/* eslint-disable max-len */
/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku 樱花弹幕
// @namespace    https://muted.top/
// @version      0.9.0
// @description  yhdm, but with Danmaku from Bilibili  让樱花动漫加载 Bilibili 弹幕
// @author       MUTED64
// @match        *://*.yhdmp.cc/vp/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addElement
// @connect      api.bilibili.com
// @icon         https://www.yhdmp.cc/yxsf/yh_pic/favicon.ico
// @require      https://bowercdn.net/c/danmaku-2.0.4/dist/danmaku.dom.min.js
// @require      https://greasyfork.org/scripts/454443-sakuradanmakuclasses/code/SakuraDanmakuClasses.js?version=1122384
// @license      GPLv3
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
  const autoLoadedMessage = `自动加载弹幕：\n${keyword} 第${episode}集\n如果不是你想要的，请手动填入对应番剧`;
  const loadFailedMessage = `加载弹幕失败：\n${keyword} 第${episode}集\n请检查B站是否存在对应剧集`;
  let danmaku;
  let danmakuLoader;
  let danmakuDOM;

  const iframeDocument = iframe.contentWindow.document;
  const container = iframeDocument.querySelector("div.dplayer-video-wrap");
  const video = iframeDocument.querySelector("div.dplayer-video-wrap > video");
  const iconsBar = iframeDocument.querySelector(
    "div.dplayer-controller > div.dplayer-icons.dplayer-icons-right"
  );

  try {
    danmaku = await loadFromBilibili(keyword, episode);
    addDialog(autoLoadedMessage);
  } catch {
    addDialog(loadFailedMessage);
  }

  function addDialog(message) {
    GM_addElement(document.body, "div", {
      style:
        "position:fixed;\
              top:50%;\
              left:1em;\
              transform:translateY(-50%);\
              background-color:rgba(0,0,0,0.7);\
              color:white;\
              font:1em sans-serif;\
              padding:1em;\
              border-radius:1em;\
              line-height:1.5;\
              min-width:17em;",
      class: "danmakuChoose",
    });

    document.querySelector(
      ".danmakuChoose"
    ).innerHTML = `<pre style="margin:0">${message}</pre>
    <div style="display:flex;justify-content:space-between;margin:1em 0;"><label for="keyword">番剧名称</label><input style="border-radius:0.2em;padding:0 0.2em;" id="keyword" value="${keyword}"/></div>
    <div style="display:flex;justify-content:space-between;margin:1em 0;"><label for="episode">剧集数</label><input style="border-radius:0.2em;padding:0 0.2em;" id="episode" value="${episode}"/></div>
    <button id="manualDanmakuButton" style="width:100%;margin-bottom:0.2em;">确认</button>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:2em 0 0 0;"><p style="flex:3;display:inline-flex;">或手动上传XML弹幕文件</p><button id="uploadXMLButton" style="flex:1;">选择</button></div>`;

    document
      .querySelector("#manualDanmakuButton")
      .addEventListener("click", () => {
        const keyword = document.querySelector("#keyword").value;
        const episode = document.querySelector("#episode").value;
        reloadDanmaku(keyword, episode);
      });

    document.querySelector("#uploadXMLButton").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "text/xml";
      input.addEventListener("change", () => {
        const reader = new FileReader();
        reader.onload = () => {
          const xml = reader.result;
          reloadDanmaku(null, null, xml);
        };
        reader.readAsText(input.files[0]);
      });
      input.click();
    });
  }

  async function loadFromBilibili(keyword, episode, xml) {
    danmakuLoader = new DanmakuLoader(keyword, episode, container, video);
    danmaku = await danmakuLoader.showDanmaku(xml);
    danmakuDOM = danmakuLoader.container.lastElementChild;
    new DanmakuSettings(danmakuLoader, danmakuDOM, iconsBar, iframeDocument);
    return danmaku;
  }

  async function reloadDanmaku(keyword, episode, xml) {
    if (danmaku) {
      danmaku.destroy();
    }
    await loadFromBilibili(keyword, episode, xml);
  }
}

const iframe = document.querySelector("iframe");
iframe.onload = loadDanmaku;
