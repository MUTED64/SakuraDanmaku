/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku
// @namespace    https://muted.top/
// @version      0.3
// @description  yhdm, but with Danmaku from Bilibili
// @author       MUTED64
// @match        https://www.yhdmp.cc/yxsf/player/dpx2/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yhdmp.cc
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/danmaku@latest/dist/danmaku.min.js
// @run-at       document-end
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
        return {
          text: $d.childNodes[0].nodeValue,
          mode,
          time: values[0] * 1,
          style: {
            fontSize: `${fontSize}px`,
            color: `#${color}`,
            textShadow: "0px 1px 3px #000,0px 0px 3px #000",
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

class DanmakuSettings {
  danmakuWrapper;
  danmakuButton;
  danmakuSettingBox;
  showOrHideDanmaku;
  buttonHtml =
    "<button class=\"dplayer-icon dplayer-comment-icon\" data-balloon=\"弹幕设置\" data-balloon-pos=\"up\"><span class=\"dplayer-icon-content\"><svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewBox=\"0 0 32 32\"><path d=\"M27.128 0.38h-22.553c-2.336 0-4.229 1.825-4.229 4.076v16.273c0 2.251 1.893 4.076 4.229 4.076h4.229v-2.685h8.403l-8.784 8.072 1.566 1.44 7.429-6.827h9.71c2.335 0 4.229-1.825 4.229-4.076v-16.273c0-2.252-1.894-4.076-4.229-4.076zM28.538 19.403c0 1.5-1.262 2.717-2.819 2.717h-8.36l-0.076-0.070-0.076 0.070h-11.223c-1.557 0-2.819-1.217-2.819-2.717v-13.589c0-1.501 1.262-2.718 2.819-2.718h19.734c1.557 0 2.819-0.141 2.819 1.359v14.947zM9.206 10.557c-1.222 0-2.215 0.911-2.215 2.036s0.992 2.035 2.215 2.035c1.224 0 2.216-0.911 2.216-2.035s-0.992-2.036-2.216-2.036zM22.496 10.557c-1.224 0-2.215 0.911-2.215 2.036s0.991 2.035 2.215 2.035c1.224 0 2.215-0.911 2.215-2.035s-0.991-2.036-2.215-2.036zM15.852 10.557c-1.224 0-2.215 0.911-2.215 2.036s0.991 2.035 2.215 2.035c1.222 0 2.215-0.911 2.215-2.035s-0.992-2.036-2.215-2.036z\"></path></svg></span></button>";

  constructor(danmaku, danmakuDOM) {
    this.danmaku = danmaku;
    this.danmakuDOM = danmakuDOM;
    this.#createButton();
    this.#createSettingBox();
    this.#addSettingItems();
  }

  #createButton() {
    // 创建按钮
    this.danmakuWrapper = document.createElement("div");
    this.danmakuWrapper.setAttribute("class", "dplayer-setting");
    this.danmakuWrapper.setAttribute(
      "style",
      "display:inline-block;height:100%;"
    );
    this.danmakuWrapper.innerHTML = this.buttonHtml;
    // 添加到播放器
    const playerIconsRight = document.querySelector(
      "div.dplayer-controller > div.dplayer-icons.dplayer-icons-right"
    );
    playerIconsRight.prepend(this.danmakuWrapper);
    this.danmakuButton = this.danmakuWrapper.firstChild;

    // 设定打开和关闭面板的操作
    this.danmakuButton.addEventListener("click", () => {
      if (this.danmakuSettingBox.style.transform === "scale(0)") {
        this.danmakuSettingBox.style.transform = "scale(1)";
      } else {
        this.danmakuSettingBox.style.transform = "scale(0)";
      }
    });
    document.addEventListener("click", (e) => {
      if (
        !e.path.includes(this.danmakuButton) &&
        !e.path.includes(this.danmakuSettingBox)
      ) {
        this.danmakuSettingBox.style.transform = "scale(0)";
      }
    });
  }

  #createSettingBox() {
    this.danmakuSettingBox = document.createElement("div");
    this.danmakuSettingBox.setAttribute("class", "dplayer-setting-box");
    this.danmakuSettingBox.setAttribute("style", "transform: scale(0);");
    this.danmakuSettingBox.setAttribute("style", "width: 200px;");
    this.danmakuWrapper.appendChild(this.danmakuSettingBox);
  }

  #addSettingItems() {
    this.#addShowOrHide();
    this.#addDanmakuSpeed();
    this.#addDanmakuOpacity();
    this.#addDanmakuFontSize();
    this.#addDanmakuLimit();
  }

  #addShowOrHide() {
    this.showOrHideDanmaku = document.createElement("div");
    this.showOrHideDanmaku.setAttribute(
      "class",
      "dplayer-setting-item show-danmaku"
    );
    this.showOrHideDanmaku.style.display = "block";
    this.showOrHideDanmaku.innerHTML =
      "<span class=\"dplayer-label\">显示弹幕</span>";
    this.showOrHideToggle = document.createElement("input");
    this.showOrHideToggle.setAttribute("type", "checkbox");
    this.showOrHideToggle.setAttribute("checked", "checked");
    this.showOrHideToggle.style.float = "right";
    this.showOrHideToggle.addEventListener("click", () => {
      if (this.showOrHideToggle.checked) {
        danmakuDOM.setAttribute("style", "display:block;");
      } else {
        danmakuDOM.setAttribute("style", "display:none;");
      }
    });
    this.showOrHideDanmaku.appendChild(this.showOrHideToggle);
    this.danmakuSettingBox.appendChild(this.showOrHideDanmaku);
  }

  #addDanmakuSpeed() {
    this.danmakuSpeed = document.createElement("div");
    this.danmakuSpeed.setAttribute(
      "class",
      "dplayer-setting-item speed-danmaku"
    );
    this.danmakuSpeed.style.display = "block";
    this.danmakuSpeed.innerHTML = "<span class=\"dplayer-label\">弹幕速度</span>";
    this.danmakuSpeedRange = document.createElement("input");
    this.danmakuSpeedRange.setAttribute("type", "range");
    this.danmakuSpeedRange.style.display = "inline-block";
    this.danmakuSpeedRange.style.float = "right";
    this.danmakuSpeedRange.style.width = "50%";
    this.danmakuSpeedRange.setAttribute("min", 72);
    this.danmakuSpeedRange.setAttribute("max", 288);
    this.danmakuSpeedRange.setAttribute("value", 144);
    this.danmakuSpeedRange.addEventListener("input", () => {
      this.danmaku.speed = Number(this.danmakuSpeedRange.value);
    });
    this.danmakuSpeed.appendChild(this.danmakuSpeedRange);
    this.danmakuSettingBox.appendChild(this.danmakuSpeed);
  }

  #addDanmakuOpacity() {
    this.danmakuOpacity = document.createElement("div");
    this.danmakuOpacity.setAttribute(
      "class",
      "dplayer-setting-item transparency-danmaku"
    );
    this.danmakuOpacity.style.display = "block";
    this.danmakuOpacity.innerHTML =
      "<span class=\"dplayer-label\">弹幕透明度</span>";
    this.danmakuOpacityRange = document.createElement("input");
    this.danmakuOpacityRange.setAttribute("type", "range");
    this.danmakuOpacityRange.style.display = "inline-block";
    this.danmakuOpacityRange.style.float = "right";
    this.danmakuOpacityRange.style.width = "50%";
    this.danmakuOpacityRange.setAttribute("min", 0);
    this.danmakuOpacityRange.setAttribute("max", 1);
    this.danmakuOpacityRange.setAttribute("step", 0.1);
    this.danmakuOpacityRange.setAttribute("value", 1);
    this.danmakuOpacityRange.addEventListener("input", () => {
      danmakuDOM.style.opacity = Number(this.danmakuOpacityRange.value);
    });
    this.danmakuOpacity.appendChild(this.danmakuOpacityRange);
    this.danmakuSettingBox.appendChild(this.danmakuOpacity);
  }

  #addDanmakuFontSize() {
    this.danmakuFontSize = document.createElement("div");
    this.danmakuFontSize.setAttribute(
      "class",
      "dplayer-setting-item font-size-danmaku"
    );
    this.danmakuFontSize.style.display = "block";
    this.danmakuFontSize.innerHTML =
      "<span class=\"dplayer-label\">弹幕字体大小</span>";
    this.danmakuFontSizeRange = document.createElement("input");
    this.danmakuFontSizeRange.setAttribute("type", "range");
    this.danmakuFontSizeRange.style.display = "inline-block";
    this.danmakuFontSizeRange.style.float = "right";
    this.danmakuFontSizeRange.style.width = "50%";
    this.danmakuFontSizeRange.setAttribute("min", 16);
    this.danmakuFontSizeRange.setAttribute("max", 32);
    this.danmakuFontSizeRange.setAttribute("step", 1);
    this.danmakuFontSizeRange.setAttribute("value", 25);
    this.danmakuFontSizeRange.addEventListener("input", () => {
      for (const i of this.danmaku.comments) {
        i.style.font = `${Number(
          this.danmakuFontSizeRange.value
        )}px sans-serif`;
      }
    });
    this.danmakuFontSize.appendChild(this.danmakuFontSizeRange);
    this.danmakuSettingBox.appendChild(this.danmakuFontSize);
  }

  #addDanmakuLimit() {
    this.danmakuLimit = document.createElement("div");
    this.danmakuLimit.setAttribute(
      "class",
      "dplayer-setting-item limit-danmaku"
    );
    this.danmakuLimit.style.display = "block";
    this.danmakuLimit.innerHTML = "<span class=\"dplayer-label\">弹幕密度</span>";
    this.danmakuLimitRange = document.createElement("input");
    this.danmakuLimitRange.setAttribute("type", "range");
    this.danmakuLimitRange.style.display = "inline-block";
    this.danmakuLimitRange.style.float = "right";
    this.danmakuLimitRange.style.width = "50%";
    this.danmakuLimitRange.setAttribute("min", 0);
    this.danmakuLimitRange.setAttribute("max", 1);
    this.danmakuLimitRange.setAttribute("step", 0.01);
    this.danmakuLimitRange.setAttribute("value", 1);
    this.danmakuLimitRange.addEventListener("input", () => {
      for (const i of this.danmaku.comments) {
        i.style.display = "block";
        if(Math.random()>Number(this.danmakuLimitRange.value)){
          i.style.display = "none";
        }
      }
    });
    this.danmakuLimit.appendChild(this.danmakuLimitRange);
    this.danmakuSettingBox.appendChild(this.danmakuLimit);
  }
}

const episode_url = "https://www.bilibili.com/bangumi/play/ep693247";
const episode = 2;
const danmakuLoader = new DanmakuLoader(episode_url, episode);
await danmakuLoader.showDanmaku();
const danmakuDOM = danmakuLoader.container.lastElementChild;
new DanmakuSettings(danmakuLoader.danmaku);
