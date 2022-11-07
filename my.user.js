/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku
// @namespace    https://muted.top/
// @version      0.2
// @description  yhdm, but with Danmaku from Bilibili
// @author       MUTED64
// @match        https://www.yhdmp.cc/yxsf/player/dpx2/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yhdmp.cc
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/danmaku@latest/dist/danmaku.min.js
// ==/UserScript==

"use strict";
class BilibiliDanmaku {
  static #EP_API_BASE = "https://api.bilibili.com/pgc/view/web/season/";
  static #DANMAKU_API_BASE = "https://api.bilibili.com/x/v1/dm/list.so/";

  constructor(
    episode_url = "https://www.bilibili.com/bangumi/play/ep693247",
    episode = 1
  ) {
    this.episode = episode; // 第几话
    this.episode_url = episode_url;
  }

  // GM_xmlhttpRequest的Promise封装
  #makeGetRequest(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: (response) => {
          resolve(response.responseText);
        },
        onerror: (error) => {
          reject(error);
        },
      });
    });
  }

  // Bilibili弹幕xml串转换为可加载的对象
  #parseBilibiliDanmaku(string) {
    const $xml = new DOMParser().parseFromString(string, "text/xml");
    return [...$xml.getElementsByTagName("d")]
      .map(($d) => {
        const p = $d.getAttribute("p");
        if (p === null || $d.childNodes[0] === undefined) return null;
        const values = p.split(",");
        const mode = { 6: "ltr", 1: "rtl", 5: "top", 4: "bottom" }[values[1]];
        if (!mode) return null;
        const fontSize = Number(values[2]) || 25;
        const color = `000000${Number(values[3]).toString(16)}`.slice(-6);
        // const gray =
        //   ("0x"+color.slice(0, 2) | 0) * 0.299 +
        //   ("0x"+color.slice(2, 4) | 0) * 0.587 +
        //   ("0x"+color.slice(4, 6) | 0) * 0.114;
        return {
          text: $d.childNodes[0].nodeValue,
          mode,
          time: values[0] * 1,
          style: {
            fontSize: `${fontSize}px`,
            color: `#${color}`,
            textShadow: "0px 1px 4px #000a",
            font: `${fontSize}px sans-serif`,
            fillStyle: `#${color}`,
            strokeStyle: color === "000000" ? "#fff" : "#000",
            lineWidth: 2.0,
          },
        };
      })
      .filter((x) => x);
  }

  // 获取Bilibili对应视频的弹幕
  async getInfoAndDanmaku() {
    // 获取epid
    this.epid = (this.episode_url.match(/\/ep(\d+)/i) || [])[1] || "";

    // 获取cid
    let { code, message, result } = JSON.parse(
      await this.#makeGetRequest(
        `${this.constructor.#EP_API_BASE}?ep_id=${this.epid}`
      )
    );
    if (code) {
      throw new Error(message);
    }
    this.cid = result.episodes[episode - 1].cid;

    // 获取弹幕
    this.comments = this.#parseBilibiliDanmaku(
      await this.#makeGetRequest(
        `${this.constructor.#DANMAKU_API_BASE}?oid=${this.cid}`
      )
    );
    this.basic_info = {
      epid: this.epid,
      cid: this.cid,
      comments: this.comments,
    };
    // localStorage[`basic_info_${cid}`] = JSON.stringify(basic_info);
    return this.basic_info;
  }
}

class DanmakuLoader {
  danmaku;

  constructor(
    episode_url = "https://www.bilibili.com/bangumi/play/ep674708",
    episode = 1,
    container = document.querySelector("#player1 > div.dplayer-video-wrap"),
    video = document.querySelector("#player1 > div.dplayer-video-wrap > video")
  ) {
    this.episode_url = episode_url;
    this.episode = episode;
    this.container = container;
    this.video = video;
  }

  async #loadDanmaku() {
    const bilibiliDanmaku = new BilibiliDanmaku(this.episode_url, this.episode);
    this.basic_info = await bilibiliDanmaku.getInfoAndDanmaku(this.episode_url);
    this.danmaku = new Danmaku({
      container: this.container,
      media: this.video,
      comments: this.basic_info.comments,
      speed: 144,
    });
  }

  async showDanmaku() {
    await this.#loadDanmaku();
    this.video.style.position = "absolute";
    this.danmaku.show();
    let resizeObserver = new ResizeObserver(() => {
      this.danmaku.resize();
    });
    resizeObserver.observe(this.container);
  }
}

const episode_url = "https://www.bilibili.com/bangumi/play/ep693247";
const episode = 1;
const danmakuLoader = new DanmakuLoader(episode_url, episode);
await danmakuLoader.showDanmaku();
