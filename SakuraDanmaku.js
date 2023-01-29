/* eslint-disable max-len */
/* eslint-disable no-undef */
// ==UserScript==
// @name         SakuraDanmaku 樱花弹幕
// @namespace    https://greasyfork.org/en/scripts/455196-sakuradanmaku-%E6%A8%B1%E8%8A%B1%E5%BC%B9%E5%B9%95
// @version      0.9.3
// @description  yhdm, but with Danmaku from Bilibili  让樱花动漫加载 Bilibili 弹幕
// @author       MUTED64
// @match        https://*.yhdmp.cc/vp/*
// @match        https://*.mgnacg.com/bangumi/*
// @match        https://www.yhdmp.cc/yxsf/player/dpx2/*
// @match        https://play.mknacg.top:8585/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addElement
// @connect      api.bilibili.com
// @icon         https://www.yhdmp.cc/yxsf/yh_pic/favicon.ico
// @require      https://bowercdn.net/c/danmaku-2.0.4/dist/danmaku.dom.min.js
// @license      GPLv3
// @run-at       document-end
// ==/UserScript==

"use strict";

const sites = {
  yhdm: {
    address: /.*:\/\/.*\.yhdmp\.cc\/vp\/.*/,
    videoFrame: "iframe",
    videoFrameURL: "https://www.yhdmp.cc/yxsf/player/dpx2",
    bangumiTitle: "title",
    episode: "div.gohome > span",
    container: "div.dplayer-video-wrap",
    video: "div.dplayer-video-wrap > video",
    iconsBar: "div.dplayer-controller > div.dplayer-icons.dplayer-icons-right",
  },
  mgnacg: {
    address: /.*:\/\/.*\.mgnacg\.com\/bangumi\/.*/,
    videoFrame: "iframe#videoiframe",
    videoFrameURL: "https://play.mknacg.top:8585",
    bangumiTitle: "h1.page-title > a",
    episode: "span.btn-pc.page-title",
    container: "div.art-video-player",
    video: "div.art-video-player > video.art-video",
    iconsBar: "div.art-video-player div.art-bottom > div.art-controls-right",
  },
};

class BilibiliDanmaku {
  static #EP_API_BASE = "https://api.bilibili.com/pgc/view/web/season";
  static #DANMAKU_API_BASE = "https://api.bilibili.com/x/v1/dm/list.so";
  static #KEYWORD_API_BASE =
    "https://api.bilibili.com/x/web-interface/search/type?search_type=media_bangumi";

  constructor(keyword, episode) {
    this.keyword = keyword;
    this.episode = episode;
  }

  // GM_xmlhttpRequest的Promise封装
  #Get(url) {
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
          baseTime: values[0] * 1,
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
  async getInfoAndDanmaku(xml = undefined) {
    if (!xml) {
      const fetchedFromKeyword = JSON.parse(
        await this.#Get(
          `${this.constructor.#KEYWORD_API_BASE}&keyword=${this.keyword}`
        )
      ).data.result;

      this.mdid = fetchedFromKeyword[0].media_id;
      this.ssid = fetchedFromKeyword[0].season_id;
      this.epid = fetchedFromKeyword[0].eps[0].id;

      // 获取cid
      let { code, message, result } = JSON.parse(
        await this.#Get(`${this.constructor.#EP_API_BASE}?ep_id=${this.epid}`)
      );
      if (code) {
        throw new Error(message);
      }
      this.cid = result.episodes[this.episode - 1].cid;

      // 获取弹幕
      this.danmaku = this.#parseBilibiliDanmaku(
        await this.#Get(`${this.constructor.#DANMAKU_API_BASE}?oid=${this.cid}`)
      );
      this.basic_info = {
        mdid: this.mdid,
        ssid: this.ssid,
        epid: this.epid,
        cid: this.cid,
        danmaku: this.danmaku,
      };
      return this.basic_info;
    } else {
      this.basic_info = { danmaku: this.#parseBilibiliDanmaku(xml) };
      return this.basic_info;
    }
  }
}

class DanmakuLoader {
  danmaku;

  constructor(keyword, episode, container, video) {
    this.keyword = keyword;
    this.episode = episode;
    this.container = document.querySelector(container);
    this.video = document.querySelector(video);
  }

  async #loadDanmaku(xml) {
    const bilibiliDanmaku = new BilibiliDanmaku(this.keyword, this.episode);
    this.basic_info = await bilibiliDanmaku.getInfoAndDanmaku(xml);
    this.danmaku = new Danmaku({
      container: this.container,
      media: this.video,
      comments: this.basic_info.danmaku,
      speed: 144,
    });
  }

  async showDanmaku(xml) {
    await this.#loadDanmaku(xml);
    this.video.style.position = "absolute";
    this.danmaku.show();
    let resizeObserver = new ResizeObserver(() => {
      this.danmaku.resize();
    });
    resizeObserver.observe(this.container);
    return this.danmaku;
  }
}

class DanmakuSettings {
  danmakuWrapper;
  danmakuButton;
  danmakuSettingBox;
  buttonHtml =
    '<button class="dplayer-icon dplayer-comment-icon" data-balloon="弹幕设置" data-balloon-pos="up"><span class="dplayer-icon-content"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M27.128 0.38h-22.553c-2.336 0-4.229 1.825-4.229 4.076v16.273c0 2.251 1.893 4.076 4.229 4.076h4.229v-2.685h8.403l-8.784 8.072 1.566 1.44 7.429-6.827h9.71c2.335 0 4.229-1.825 4.229-4.076v-16.273c0-2.252-1.894-4.076-4.229-4.076zM28.538 19.403c0 1.5-1.262 2.717-2.819 2.717h-8.36l-0.076-0.070-0.076 0.070h-11.223c-1.557 0-2.819-1.217-2.819-2.717v-13.589c0-1.501 1.262-2.718 2.819-2.718h19.734c1.557 0 2.819-0.141 2.819 1.359v14.947zM9.206 10.557c-1.222 0-2.215 0.911-2.215 2.036s0.992 2.035 2.215 2.035c1.224 0 2.216-0.911 2.216-2.035s-0.992-2.036-2.216-2.036zM22.496 10.557c-1.224 0-2.215 0.911-2.215 2.036s0.991 2.035 2.215 2.035c1.224 0 2.215-0.911 2.215-2.035s-0.991-2.036-2.215-2.036zM15.852 10.557c-1.224 0-2.215 0.911-2.215 2.036s0.991 2.035 2.215 2.035c1.222 0 2.215-0.911 2.215-2.035s-0.992-2.036-2.215-2.036z"></path></svg></span></button>';

  constructor(danmakuLoader, danmakuDOM, iconsBar) {
    this.danmaku = danmakuLoader.danmaku;
    this.danmakuLoader = danmakuLoader;
    this.danmakuDOM = danmakuDOM;
    this.danmakuDOM.style.zIndex = 1000;
    this.iconsBar = document.querySelector(iconsBar);
    this.danmakuSettings = GM_getValue("danmakuSettings", {
      show: true,
      speed: 144,
      opacity: 1,
      fontSize: 25,
      limit: 1,
    });
    this.#createButton();
    this.#createSettingBox();
    this.#addSettingItems();
  }

  #createButton() {
    if (document.querySelector("#danmaku-wrapper")) {
      document.querySelector("#danmaku-wrapper").remove();
    }
    // 创建按钮
    this.danmakuWrapper = document.createElement("div");
    this.danmakuWrapper.setAttribute("id", "danmaku-wrapper");
    this.danmakuWrapper.setAttribute("class", "dplayer-setting");
    this.danmakuWrapper.setAttribute(
      "style",
      "display:inline-block;height:100%;"
    );
    this.danmakuWrapper.innerHTML = this.buttonHtml;
    // 添加到播放器
    this.iconsBar.prepend(this.danmakuWrapper);
    this.danmakuButton = this.danmakuWrapper.firstChild;

    // 设定打开和关闭面板的操作
    this.danmakuButton.addEventListener("click", () => {
      if (
        this.danmakuSettingBox.style.transform === "scale(0)" ||
        !this.danmakuSettingBox.style.transform
      ) {
        this.danmakuSettingBox.style.transform = "scale(1)";
      } else {
        this.danmakuSettingBox.style.transform = "scale(0)";
      }
    });
    document.addEventListener("click", (e) => {
      if (
        !e.composedPath().includes(this.danmakuButton) &&
        !e.composedPath().includes(this.danmakuSettingBox)
      ) {
        this.danmakuSettingBox.style.transform = "scale(0)";
      }
    });

    // 调整一下底栏样式，原来的看不太清
    document.querySelector(".dplayer-controller").style.backgroundColor =
      "#0002";
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
    this.#addOffsetSetting();
  }

  #addShowOrHide() {
    this.showOrHideDanmaku = document.createElement("div");
    this.showOrHideDanmaku.setAttribute(
      "class",
      "dplayer-setting-item show-danmaku"
    );
    this.showOrHideDanmaku.style.display = "block";
    this.showOrHideDanmaku.innerHTML =
      '<span class="dplayer-label">显示弹幕</span>';
    this.showOrHideToggle = document.createElement("input");
    this.showOrHideToggle.setAttribute("type", "checkbox");
    this.danmakuSettings.show
      ? this.showOrHideToggle.setAttribute("checked", "checked")
      : null;
    this.showOrHideToggle.style.float = "right";
    this.danmakuDOM.setAttribute(
      "style",
      this.danmakuSettings.show ? "display:block;" : "display:none;"
    );
    this.showOrHideToggle.addEventListener("click", () => {
      if (this.showOrHideToggle.checked) {
        this.danmakuDOM.setAttribute("style", "display:block;");
        this.danmakuSettings.show = true;
        GM_setValue("danmakuSettings", this.danmakuSettings);
      } else {
        this.danmakuDOM.setAttribute("style", "display:none;");
        this.danmakuSettings.show = false;
        GM_setValue("danmakuSettings", this.danmakuSettings);
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
    this.danmakuSpeed.innerHTML = '<span class="dplayer-label">弹幕速度</span>';
    this.danmakuSpeedRange = document.createElement("input");
    this.danmakuSpeedRange.setAttribute("type", "range");
    this.danmakuSpeedRange.style.display = "inline-block";
    this.danmakuSpeedRange.style.float = "right";
    this.danmakuSpeedRange.style.width = "50%";
    this.danmakuSpeedRange.setAttribute("min", 72);
    this.danmakuSpeedRange.setAttribute("max", 288);
    this.danmakuSpeedRange.setAttribute("value", this.danmakuSettings.speed);
    this.danmaku.speed = this.danmakuSettings.speed;
    this.danmakuSpeedRange.addEventListener("input", () => {
      this.danmakuSettings.speed = Number(this.danmakuSpeedRange.value);
      GM_setValue("danmakuSettings", this.danmakuSettings);
      this.danmaku.speed = this.danmakuSettings.speed;
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
      '<span class="dplayer-label">弹幕透明度</span>';
    this.danmakuOpacityRange = document.createElement("input");
    this.danmakuOpacityRange.setAttribute("type", "range");
    this.danmakuOpacityRange.style.display = "inline-block";
    this.danmakuOpacityRange.style.float = "right";
    this.danmakuOpacityRange.style.width = "50%";
    this.danmakuOpacityRange.setAttribute("min", 0);
    this.danmakuOpacityRange.setAttribute("max", 1);
    this.danmakuOpacityRange.setAttribute("step", 0.1);
    this.danmakuOpacityRange.setAttribute(
      "value",
      this.danmakuSettings.opacity
    );
    this.danmakuDOM.style.opacity = this.danmakuSettings.opacity;
    this.danmakuOpacityRange.addEventListener("input", () => {
      this.danmakuSettings.opacity = Number(this.danmakuOpacityRange.value);
      GM_setValue("danmakuSettings", this.danmakuSettings);
      this.danmakuDOM.style.opacity = this.danmakuSettings.opacity;
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
      '<span class="dplayer-label">弹幕字体大小</span>';
    this.danmakuFontSizeRange = document.createElement("input");
    this.danmakuFontSizeRange.setAttribute("type", "range");
    this.danmakuFontSizeRange.style.display = "inline-block";
    this.danmakuFontSizeRange.style.float = "right";
    this.danmakuFontSizeRange.style.width = "50%";
    this.danmakuFontSizeRange.setAttribute("min", 16);
    this.danmakuFontSizeRange.setAttribute("max", 32);
    this.danmakuFontSizeRange.setAttribute("step", 1);
    this.danmakuFontSizeRange.setAttribute(
      "value",
      this.danmakuSettings.fontSize
    );
    setDanmakuFontSize(this.danmakuSettings.fontSize, this.danmaku);
    this.danmakuFontSizeRange.addEventListener("input", () => {
      this.danmakuSettings.fontSize = Number(this.danmakuFontSizeRange.value);
      GM_setValue("danmakuSettings", this.danmakuSettings);
      setDanmakuFontSize(this.danmakuSettings.fontSize, this.danmaku);
    });
    this.danmakuFontSize.appendChild(this.danmakuFontSizeRange);
    this.danmakuSettingBox.appendChild(this.danmakuFontSize);

    function setDanmakuFontSize(fontSize, danmaku) {
      for (const i of danmaku.comments) {
        i.style.font = `${fontSize}px sans-serif`;
      }
    }
  }

  #addDanmakuLimit() {
    this.danmakuLimit = document.createElement("div");
    this.danmakuLimit.setAttribute(
      "class",
      "dplayer-setting-item limit-danmaku"
    );
    this.danmakuLimit.style.display = "block";
    this.danmakuLimit.innerHTML = '<span class="dplayer-label">弹幕密度</span>';
    this.danmakuLimitRange = document.createElement("input");
    this.danmakuLimitRange.setAttribute("type", "range");
    this.danmakuLimitRange.style.display = "inline-block";
    this.danmakuLimitRange.style.float = "right";
    this.danmakuLimitRange.style.width = "50%";
    this.danmakuLimitRange.setAttribute("min", 0);
    this.danmakuLimitRange.setAttribute("max", 1);
    this.danmakuLimitRange.setAttribute("step", 0.01);
    this.danmakuLimitRange.setAttribute("value", this.danmakuSettings.limit);
    limitDanmaku(this.danmakuSettings.limit, this.danmaku);
    this.danmakuLimitRange.addEventListener("input", () => {
      this.danmakuSettings.limit = Number(this.danmakuLimitRange.value);
      GM_setValue("danmakuSettings", this.danmakuSettings);
      limitDanmaku(this.danmakuSettings.limit, this.danmaku);
    });
    this.danmakuLimit.appendChild(this.danmakuLimitRange);
    this.danmakuSettingBox.appendChild(this.danmakuLimit);

    function limitDanmaku(percent, danmaku) {
      for (const i of danmaku.comments) {
        i.style.display = "block";
        if (Math.random() > percent) {
          i.style.display = "none";
        }
      }
    }
  }

  #addOffsetSetting() {
    this.offsetSetting = document.createElement("div");
    this.offsetSetting.setAttribute("class", "dplayer-setting-item offset");
    this.offsetSetting.style.display = "block";
    this.offsetSetting.innerHTML =
      '<span class="dplayer-label">弹幕偏移(s)</span>';
    this.offsetNumber = document.createElement("input");
    this.offsetNumber.setAttribute("type", "number");
    this.offsetNumber.style.display = "inline-block";
    this.offsetNumber.style.float = "right";
    this.offsetNumber.style.width = "47%";
    this.offsetNumber.setAttribute("min", -10);
    this.offsetNumber.setAttribute("max", 10);
    this.offsetNumber.setAttribute("step", 0.1);
    this.offsetNumber.setAttribute("value", 0);
    this.offsetNumber.addEventListener("input", () => {
      for (const comment of this.danmaku.comments) {
        comment.time = comment.baseTime - Number(this.offsetNumber.value);
      }
      this.danmakuLoader.video.currentTime = Number(
        this.danmakuLoader.video.currentTime
      );
    });
    this.offsetSetting.appendChild(this.offsetNumber);
    this.danmakuSettingBox.appendChild(this.offsetSetting);
  }
}

const currentSite =
  sites[
    Object.keys(sites).find((site) =>
      window.location.href.match(sites[site].address)
    )
  ];

if (currentSite) {
  const keyword = document
    .querySelector(currentSite.bangumiTitle)
    .textContent.replace(/ 第[0-9]+集.*/gi, "")
    .replace(/ 第[0-9]+话.*/gi, "")
    .replace(/ Part ?[0-9]+.*/, "");
  const episode = Number(
    document.querySelector(currentSite.episode).textContent.replace(/[^0-9]+/gi, "")
  );

  const iframe = document.querySelector(currentSite.videoFrame);
  let xml;
  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      {
        keyword,
        episode,
        site: currentSite,
        xml,
      },
      currentSite.videoFrameURL
    );
  });
} else {
  window.addEventListener("message", async (event) => {
    event.stopPropagation();
    if (event.data.site) {
      const { keyword, episode, site, xml } = event.data;
      const danmakuLoader = await new DanmakuLoader(
        keyword,
        episode,
        site.container,
        site.video
      );
      const danmaku = await danmakuLoader.showDanmaku(xml);
      const danmakuDOM = await danmakuLoader.container.lastElementChild;
      await new DanmakuSettings(danmakuLoader, danmakuDOM, site.iconsBar);
      return danmaku;
    }
  },false);
}

async function loadDanmaku(site) {
  const keyword = document
    .querySelector(site.bangumiTitle)
    .textContent.replace(/ 第[0-9]+集.*/gi, "")
    .replace(/ 第[0-9]+话.*/gi, "")
    .replace(/ Part ?[0-9]+.*/, "");
  const episode = Number(
    document.querySelector(site.episode).textContent.replace(/[^0-9]+/gi, "")
  );
  const autoLoadedMessage = `自动加载弹幕：\n${keyword} 第${episode}集\n如果不是你想要的，请手动填入对应番剧`;
  const loadFailedMessage = `加载弹幕失败：\n${keyword} 第${episode}集\n请检查B站是否存在对应剧集`;
  let danmaku;
  let danmakuLoader;
  let danmakuDOM;

  const iframeDocument = iframe.contentWindow.document;
  const container = iframeDocument.querySelector(site.container);
  const video = iframeDocument.querySelector(site.video);
  const iconsBar = iframeDocument.querySelector(site.iconsBar);

  try {
    danmaku = await loadFromBilibili(keyword, episode);
    await addDialog(autoLoadedMessage);
  } catch (e) {
    console.log(e);
    await addDialog(loadFailedMessage);
  }

  function addDialog(message) {
    GM_addElement(document.body, "div", {
      style: `position:fixed;
         top:50%;
         left:1em;
         transform:translateY(-50%);
         background-color:rgba(0,0,0,0.7);
         color:white;
         font:1em sans-serif;
         padding:1em;
         border-radius:1em;
         line-height:1.5;
         min-width:17em;`,
      class: "danmakuChoose",
    });

    document.querySelector(
      ".danmakuChoose"
    ).innerHTML = `<pre style="margin:0;font-family:sans-serif">${message}</pre>
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
    while (!container || !video) {
      await wait(1);
    }
    load();

    function wait(seconds) {
      return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
      });
    }

    async function load() {
      danmakuLoader = await new DanmakuLoader(
        keyword,
        episode,
        container,
        video
      );
      danmaku = await danmakuLoader.showDanmaku(xml);
      danmakuDOM = await danmakuLoader.container.lastElementChild;
      await new DanmakuSettings(
        danmakuLoader,
        danmakuDOM,
        iconsBar,
        iframeDocument
      );
      return danmaku;
    }
  }

  async function reloadDanmaku(keyword, episode, xml) {
    if (danmaku) {
      danmaku.destroy();
    }
    await loadFromBilibili(keyword, episode, xml);
  }
}